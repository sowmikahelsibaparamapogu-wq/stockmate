import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Barcode,
  CheckCircle2,
  Flashlight,
  SwitchCamera,
  AlertCircle,
  Scan,
  ShieldCheck,
  Package,
  MapPin,
  Layers,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface BarcodeScannerTerminalProps {
  onDetected?: (result: any) => void;
  standalone?: boolean;
}

export const BarcodeScannerTerminal: React.FC<BarcodeScannerTerminalProps> = ({
  onDetected,
  standalone = false,
}) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [scanMode, setScanMode] = useState<'camera' | 'photo'>('camera');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanTimerRef = useRef<any>(null);
  const isHandlingDetectionRef = useRef(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; type: string; timestamp: string; title: string }>>([]);

  // Photo mode states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [decodedPhotoBarcode, setDecodedPhotoBarcode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check initial permission status if browser supports navigator.permissions
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as any })
        .then((status) => {
          setCameraPermissionState(status.state as any);
          status.onchange = () => {
            setCameraPermissionState(status.state as any);
          };
        })
        .catch(() => {
          // Permissions API might not support 'camera' in some environments
        });
    }
  }, []);

  // Audio confirmation chime
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C chime
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  // Enumerate video input devices
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (e) {
      console.warn('Could not enumerate devices:', e);
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        // ignore reset error
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Primary Camera Start Function with Cascading Fallbacks & Multi-Format Scanner
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Camera API (getUserMedia) is not supported in this browser. Please use the "Scan from Photo" tab or enter barcodes manually.'
      );
      return;
    }

    let stream: MediaStream | null = null;
    const errors: any[] = [];

    // Attempt 1: Target specific device if selected, or facingMode ideal
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e1: any) {
      errors.push(e1);
      try {
        // Attempt 2: Relaxed facing mode constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });
      } catch (e2: any) {
        errors.push(e2);
        try {
          // Attempt 3: Any video device available
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e3: any) {
          errors.push(e3);
        }
      }
    }

    if (!stream) {
      const lastError = errors[errors.length - 1] || errors[0];
      console.warn('Camera access denied or failed:', lastError);

      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setCameraPermissionState('denied');
        setCameraError(
          'Camera access was denied by your browser. You can click "Grant Camera Access", or switch to the "Scan from Photo" tab to snap and upload pictures directly!'
        );
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        setCameraError('No active camera device found. Please use the "Scan from Photo" tab or manual entry.');
      } else {
        setCameraError(
          lastError?.message ||
            'Unable to start video feed. Switch to "Scan from Photo" tab or use manual barcode input.'
        );
      }
      setCameraActive(false);
      return;
    }

    // Success
    setCameraPermissionState('granted');
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    trackRef.current = track;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      try {
        await videoRef.current.play();
        setCameraActive(true);
      } catch (playErr) {
        console.warn('Video play error:', playErr);
      }
    }

    // Check torch / flash capability
    if (track && (track as any).getCapabilities) {
      const caps = (track as any).getCapabilities();
      setHasTorch(Boolean(caps?.torch));
    }

    refreshDevices();

    // Initialize ZXing real multi-format scanner loop
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;

    let nativeDetector: any = null;
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'data_matrix'],
        });
      } catch (e) {
        // fallback to ZXing
      }
    }

    // Scanning interval
    scanTimerRef.current = setInterval(async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        !isHandlingDetectionRef.current &&
        !loading
      ) {
        // Step A: Fast native BarcodeDetector if supported
        if (nativeDetector) {
          try {
            const barcodes = await nativeDetector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const detected = barcodes[0].rawValue.trim();
              if (detected) {
                isHandlingDetectionRef.current = true;
                handleLookup(detected);
                return;
              }
            }
          } catch (e) {
            // continue to ZXing
          }
        }

        // Step B: Pure JS Multi-Format ZXing Decoder
        try {
          const result = reader.decodeFromVideoElement(videoRef.current);
          if (result && result.getText()) {
            const detected = result.getText().trim();
            if (detected) {
              isHandlingDetectionRef.current = true;
              handleLookup(detected);
            }
          }
        } catch (e) {
          // Normal when no barcode in current frame
        }
      }
    }, 220);
  }, [facingMode, selectedDeviceId, stopCamera, loading]);

  // Lookup barcode in backend database
  const handleLookup = async (codeToLookUp: string) => {
    const trimmed = codeToLookUp.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setCameraError(null);
    try {
      const res = await fetch(`/api/v1/scan-lookup?code=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Code "${trimmed}" not found in warehouse registry`);
      }

      const data = await res.json();
      playBeep();
      if (navigator.vibrate) navigator.vibrate(140);

      const isProduct = String(data.type || '').toLowerCase() === 'product';
      const entity = data.entity || data.data || data;

      const locationsList = (entity.stockLevels || []).map((sl: any) => ({
        locationId: sl.locationId,
        locationCode: sl.location?.code || `LOC-${sl.locationId}`,
        warehouseName: sl.warehouse?.name || 'Central Distribution Center',
        quantity: sl.quantity,
      }));

      const normalizedResult = {
        type: isProduct ? 'PRODUCT' : 'LOCATION',
        data: entity,
        totalStock: entity.totalStock ?? 0,
        locations: locationsList,
        inventory: entity.stockLevels || [],
      };

      setScannedResult(normalizedResult);
      setScanHistory((prev) => [
        {
          code: trimmed,
          type: isProduct ? 'PRODUCT' : 'LOCATION',
          timestamp: new Date().toLocaleTimeString(),
          title: isProduct ? entity.name : `${entity.name} (${entity.code})`,
        },
        ...prev.slice(0, 9),
      ]);

      showToast(`Scanned: ${isProduct ? entity.name : entity.code || entity.name}`, 'success');

      if (onDetected) {
        onDetected({ ...data, entity, normalized: normalizedResult });
      }
    } catch (err: any) {
      setCameraError(err.message || 'Item or location not found');
    } finally {
      setLoading(false);
      setTimeout(() => {
        isHandlingDetectionRef.current = false;
      }, 1500);
    }
  };

  // -------------------------------------------------------------
  // Photo Scanner Logic: Accurate Image Decoding with Fallbacks
  // -------------------------------------------------------------
  const handlePhotoSelect = (file: File) => {
    if (!file) return;
    setPhotoError(null);
    setDecodedPhotoBarcode(null);
    setIsDecodingPhoto(true);

    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreview(dataUrl);

      try {
        const reader = new BrowserMultiFormatReader();
        let detectedText: string | null = null;

        // Try direct ZXing decode from image data url
        try {
          const result = await reader.decodeFromImageUrl(dataUrl);
          if (result && result.getText()) {
            detectedText = result.getText();
          }
        } catch (zErr) {
          // If direct decode failed, try native BarcodeDetector on image element
          if ('BarcodeDetector' in window) {
            try {
              const img = new Image();
              img.src = dataUrl;
              await img.decode();
              const detector = new (window as any).BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'data_matrix'],
              });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch (dErr) {
              // continue
            }
          }
        }

        if (detectedText) {
          setDecodedPhotoBarcode(detectedText);
          showToast(`Photo decoded barcode: ${detectedText}`, 'success');
          handleLookup(detectedText);
        } else {
          setPhotoError(
            'No barcode detected in this image. Ensure the barcode is clear, in-focus, and well-lit. You can also type or use test barcodes below.'
          );
        }
      } catch (err: any) {
        setPhotoError(err.message || 'Failed to decode barcode from photo.');
      } finally {
        setIsDecodingPhoto(false);
      }
    };
    fileReader.readAsDataURL(file);
  };

  // Flip camera between front and back
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setSelectedDeviceId('');
  };

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    if (!trackRef.current) return;
    try {
      const nextState = !torchOn;
      await (trackRef.current as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Torch control error:', e);
    }
  };

  // Manage camera on mount or tab change
  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [scanMode, startCamera, stopCamera]);

  return (
    <div className={`space-y-6 ${standalone ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Top Status & Controls Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400">
            <Scan className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              Optical Barcode & QR Scanner
              {cameraActive && scanMode === 'camera' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Stream
                </span>
              )}
            </h3>
            <p className="text-xs text-stone-500">
              High-precision multi-format engine (Code 128, EAN, UPC, QR) via live lens or photo snapshot.
            </p>
          </div>
        </div>

        {/* Scan Mode Toggle: Live Camera vs Photo Scan */}
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setScanMode('camera')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 ${
                scanMode === 'camera'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('photo')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 ${
                scanMode === 'photo'
                  ? 'bg-red-600 text-white font-bold shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Scan from Photo</span>
            </button>
          </div>

          {scanMode === 'camera' && cameraActive && (
            <button
              type="button"
              onClick={toggleFacingMode}
              title="Switch camera lens"
              className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}

          {scanMode === 'camera' && hasTorch && cameraActive && (
            <button
              type="button"
              onClick={toggleTorch}
              title="Toggle flashlight"
              className={`p-2 rounded-xl border transition ${
                torchOn
                  ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Viewfinder / Photo Uploader (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* MODE 1: LIVE CAMERA VIEWPORT */}
          {scanMode === 'camera' && (
            <div className="relative aspect-video sm:aspect-4/3 bg-black rounded-2xl overflow-hidden border border-stone-800 shadow-2xl flex items-center justify-center">
              {/* The Video Element */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                playsInline
                muted
              />

              {/* Inactive State with Explicit Permission Grant UI */}
              {!cameraActive && (
                <div className="p-8 text-center max-w-sm space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg">
                    <Camera className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-stone-100">Live Lens Scanner</h4>
                    <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                      Tap below to activate camera, or switch to <strong>"Scan from Photo"</strong> to snap or upload a picture.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-bold transition shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Live Camera Stream</span>
                  </button>
                </div>
              )}

              {/* Active Viewfinder Targeting Laser */}
              {cameraActive && (
                <div className="absolute inset-x-8 inset-y-8 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between w-full">
                    <span className="w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-sm shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                    <span className="w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-sm shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  </div>

                  <div className="relative w-full h-0.5 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,1)] animate-pulse">
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-red-600/90 rounded text-[9px] font-mono uppercase text-white font-extrabold tracking-widest shadow-md">
                      ALIGN BARCODE IN FRAME
                    </div>
                  </div>

                  <div className="flex justify-between w-full">
                    <span className="w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-sm shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                    <span className="w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-sm shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: SCAN FROM PHOTO (HIGH ACCURACY / SNAPSHOT / UPLOAD) */}
          {scanMode === 'photo' && (
            <div className="p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-lg space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelect(file);
                }}
              />

              {!photoPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handlePhotoSelect(file);
                  }}
                  className="p-8 border-2 border-dashed border-red-300 dark:border-red-900/60 hover:border-red-500 bg-red-50/40 dark:bg-red-950/20 rounded-2xl cursor-pointer transition text-center space-y-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-stone-800 border border-red-200 dark:border-red-800 text-red-600 flex items-center justify-center mx-auto shadow-xs group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Snap or Upload Barcode Photo
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                      Click to take a photo with your device camera or upload an image file of any carton label, package, or rack tag.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Choose Photo / Open Camera</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-video sm:aspect-4/3 bg-black rounded-xl overflow-hidden border border-stone-800 flex items-center justify-center">
                    <img
                      src={photoPreview}
                      alt="Uploaded barcode target"
                      className="w-full h-full object-contain"
                    />
                    {isDecodingPhoto && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
                        <span className="text-xs font-bold tracking-wider uppercase">Decoding Barcode...</span>
                      </div>
                    )}
                    {decodedPhotoBarcode && !isDecodingPhoto && (
                      <div className="absolute bottom-3 left-3 right-3 p-2 bg-emerald-950/90 border border-emerald-500/60 rounded-lg text-emerald-200 text-xs font-mono font-bold flex items-center justify-between">
                        <span>✓ Decoded: {decodedPhotoBarcode}</span>
                        <span className="text-[10px] uppercase bg-emerald-800 text-white px-1.5 py-0.5 rounded">Exact Match</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Another Photo</span>
                    </button>
                    {decodedPhotoBarcode && (
                      <button
                        type="button"
                        onClick={() => handleLookup(decodedPhotoBarcode)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Re-Lookup Item Telemetry</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {photoError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{photoError}</p>
                </div>
              )}
            </div>
          )}

          {/* Camera Error / Instructions Accordion */}
          {cameraError && scanMode === 'camera' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Camera Notice</span>
              </div>
              <p className="leading-relaxed">{cameraError}</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setScanMode('photo')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Switch to Photo Scanner</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-amber-300 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Hardware Scanner / Manual Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(manualCode);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan barcode with laser gun or enter SKU / location..."
                className="w-full text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl pl-10 pr-3.5 py-3 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Scan / Enter</span>
            </button>
          </form>

          {/* Quick Simulation Barcodes */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                Warehouse Test Barcodes (Click to Test Instant Telemetry)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleLookup('890123450001')}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:border-red-500 text-stone-800 dark:text-stone-200 font-mono text-xs font-medium border border-stone-200 dark:border-stone-700 transition shadow-2xs"
              >
                IR Sensor (890123450001)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('890123450004')}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:border-red-500 text-stone-800 dark:text-stone-200 font-mono text-xs font-medium border border-stone-200 dark:border-stone-700 transition shadow-2xs"
              >
                Hex Screws (890123450004)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('890123450002')}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:border-red-500 text-stone-800 dark:text-stone-200 font-mono text-xs font-medium border border-stone-200 dark:border-stone-700 transition shadow-2xs"
              >
                Bio Buffer (890123450002)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('CDC-R-A1A')}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:border-red-500 text-stone-800 dark:text-stone-200 font-mono text-xs font-medium border border-stone-200 dark:border-stone-700 transition shadow-2xs"
              >
                Rack A1A Tag (CDC-R-A1A)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Scanned Item Telemetry Card & History (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Result Card */}
          {scannedResult ? (
            <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                  {scannedResult.type} MATCH FOUND
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {scannedResult.type === 'PRODUCT' ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      {scannedResult.data.name}
                    </h4>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      SKU: <strong className="text-stone-700 dark:text-stone-300">{scannedResult.data.sku}</strong> • Barcode: {scannedResult.data.barcode}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-xs">
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Total Stock</span>
                      <span className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                        {scannedResult.totalStock} {scannedResult.data.unitOfMeasure}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase font-bold">Reorder Level</span>
                      <span className="font-bold text-stone-700 dark:text-stone-300">
                        {scannedResult.data.reorderThreshold} {scannedResult.data.unitOfMeasure}
                      </span>
                    </div>
                  </div>

                  {/* Warehouse Locations */}
                  <div>
                    <span className="text-[11px] font-bold text-stone-500 uppercase block mb-1.5">
                      Rack & Bin Locations
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {scannedResult.locations?.map((loc: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-red-600" />
                            <span className="font-semibold text-stone-800 dark:text-stone-200">
                              {loc.locationCode} ({loc.warehouseName})
                            </span>
                          </div>
                          <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                            {loc.quantity} {scannedResult.data.unitOfMeasure}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* LOCATION RESULT */
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      {scannedResult.data.name}
                    </h4>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      Code: <strong className="text-stone-700 dark:text-stone-300">{scannedResult.data.code}</strong> • Type: {scannedResult.data.type}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-stone-500 uppercase block mb-1.5">
                      Current Inventory in this Bin ({scannedResult.inventory?.length || 0})
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {scannedResult.inventory?.map((inv: any) => (
                        <div
                          key={inv.id}
                          className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-800 dark:text-stone-200">
                              {inv.product?.name}
                            </span>
                            <span className="block text-[10px] text-stone-400 font-mono">
                              SKU: {inv.product?.sku}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                            {inv.quantity} {inv.product?.unitOfMeasure}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200">No Item Scanned Yet</h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Scan with live camera, upload a photo, or click one of the test barcodes below to preview instant warehouse telemetry.
              </p>
            </div>
          )}

          {/* Scan Session History */}
          <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                Scan Session History ({scanHistory.length})
              </span>
              {scanHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScanHistory([])}
                  className="text-[10px] text-stone-400 hover:text-stone-600 font-semibold"
                >
                  Clear History
                </button>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <p className="text-[11px] text-stone-400 italic">No previous scans in this shift.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {scanHistory.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleLookup(h.code)}
                    className="p-2 rounded-lg bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div className="truncate mr-2">
                      <span className="font-semibold text-stone-800 dark:text-stone-200 block truncate">
                        {h.title}
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">{h.code}</span>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 shrink-0">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
