import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Barcode,
  CheckCircle2,
  Flashlight,
  SwitchCamera,
  Volume2,
  AlertCircle,
  Scan,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (result: any) => void;
  title?: string;
  expectedProductId?: number;
  expectedProductName?: string;
  expectedLocationId?: number;
  expectedLocationCode?: string;
}

// Sound beep on successful match / barcode detection
export const playSuccessBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // AudioContext policy
  }
};

// Distinct error tone on mismatch
export const playErrorTone = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime); // Low buzz
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext policy
  }
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  title = 'Scan Barcode or Location Tag',
  expectedProductId,
  expectedProductName,
  expectedLocationId,
  expectedLocationCode,
}) => {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanTimerRef = useRef<any>(null);
  const isHandlingDetectionRef = useRef(false);

  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Sound beep on barcode detection
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // AudioContext policy
    }
  };

  const handleLookup = useCallback(
    async (codeToLookUp: string) => {
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
          throw new Error(err.error || 'Barcode or SKU not found in warehouse registry');
        }

        const data = await res.json();
        playBeep();
        if (navigator.vibrate) navigator.vibrate(120);

        setLastScannedCode(trimmed);
        onDetected(data);
        onClose();
      } catch (err: any) {
        setCameraError(err.message || 'Item or location not found');
      } finally {
        setLoading(false);
        isHandlingDetectionRef.current = false;
      }
    },
    [token, onDetected, onClose, loading]
  );

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    let stream: MediaStream | null = null;
    const errors: any[] = [];

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (e1: any) {
      errors.push(e1);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });
      } catch (e2: any) {
        errors.push(e2);
        try {
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
      const err = errors[errors.length - 1] || errors[0];
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please click the camera icon in your address bar to allow camera access.'
          : 'Camera device unavailable or in use by another tab/app. Check permissions or select code below.'
      );
      return;
    }

    try {
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
      }

      // Check torch capability
      if (track && (track as any).getCapabilities) {
        const caps = (track as any).getCapabilities();
        setHasTorch(Boolean(caps?.torch));
      }
    } catch (err: any) {
      console.warn('Camera stream initialization error:', err);
      setCameraActive(false);
      setCameraError('Failed to display camera stream. Try refreshing or re-opening.');
    }
  }, [facingMode]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Torch Toggle
  const toggleTorch = async () => {
    if (!trackRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await (trackRef.current as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Flip Camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Setup Camera and Barcode Detection Loop on Open
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    // Initialize Barcode Detection Loop
    const setupBarcodeDetection = () => {
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'data_matrix'],
          });

          scanTimerRef.current = setInterval(async () => {
            if (
              videoRef.current &&
              videoRef.current.readyState >= 2 &&
              !isHandlingDetectionRef.current &&
              !loading
            ) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const detected = barcodes[0].rawValue;
                  if (detected && detected !== lastScannedCode) {
                    isHandlingDetectionRef.current = true;
                    handleLookup(detected);
                  }
                }
              } catch (e) {
                // Ignore transient frame drop
              }
            }
          }, 200);
        } catch (e) {
          console.warn('BarcodeDetector instantiation failed:', e);
        }
      }
    };

    setupBarcodeDetection();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, handleLookup, lastScannedCode, loading]);

  // Listen for Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-600/10 text-red-600 dark:text-red-400">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-stone-100">{title}</h3>
              <p className="text-[11px] text-stone-500">Live optical lens scanner & instant database lookup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expected Item Notification Banner */}
        {expectedProductName && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <div>
                <span className="font-semibold text-stone-500 dark:text-stone-400 block text-[10px] uppercase tracking-wider">
                  Item to Verify & Validate
                </span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {expectedProductName}
                </span>
              </div>
            </div>
            {expectedLocationCode && (
              <span className="font-mono text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-md font-semibold">
                Bin: {expectedLocationCode}
              </span>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Live Camera Viewfinder */}
          <div className="relative aspect-video sm:aspect-4/3 bg-black rounded-xl overflow-hidden border border-stone-800 flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {!cameraActive && (
              <div className="text-center p-6 text-stone-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-md">
                  <Camera className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-100">Camera Access Required</p>
                  <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1 leading-relaxed">
                    Click the button below to grant camera permissions in your browser.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-bold transition shadow-[0_0_15px_rgba(239,68,68,0.5)] inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Grant / Enable Camera Access</span>
                </button>
              </div>
            )}

            {/* Viewfinder Target Reticle & Animated Laser Bar */}
            {cameraActive && (
              <div className="absolute inset-x-10 inset-y-8 pointer-events-none flex flex-col justify-between">
                {/* Top Corner Marks */}
                <div className="flex justify-between w-full">
                  <span className="w-5 h-5 border-t-4 border-l-4 border-red-500 rounded-tl-sm shadow-sm"></span>
                  <span className="w-5 h-5 border-t-4 border-r-4 border-red-500 rounded-tr-sm shadow-sm"></span>
                </div>

                {/* Animated Scanning Laser Line */}
                <div className="relative w-full h-0.5 bg-red-500/90 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-600/80 rounded text-[9px] font-mono uppercase text-white font-bold tracking-widest">
                    ALIGN BARCODE
                  </div>
                </div>

                {/* Bottom Corner Marks */}
                <div className="flex justify-between w-full">
                  <span className="w-5 h-5 border-b-4 border-l-4 border-red-500 rounded-bl-sm shadow-sm"></span>
                  <span className="w-5 h-5 border-b-4 border-r-4 border-red-500 rounded-br-sm shadow-sm"></span>
                </div>
              </div>
            )}

            {/* In-Camera Control Overlays */}
            {cameraActive && (
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/10 text-white text-xs">
                  <button
                    type="button"
                    onClick={flipCamera}
                    title="Switch camera"
                    className="p-1.5 rounded hover:bg-white/20 transition flex items-center gap-1 text-[11px]"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Flip</span>
                  </button>

                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      title="Toggle Flashlight"
                      className={`p-1.5 rounded transition flex items-center gap-1 text-[11px] ${
                        torchOn ? 'bg-amber-500 text-stone-950 font-bold' : 'hover:bg-white/20'
                      }`}
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      <span>{torchOn ? 'Torch On' : 'Torch'}</span>
                    </button>
                  )}
                </div>

                <div className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-stone-300 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE SCANNER
                </div>
              </div>
            )}
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="font-semibold">{cameraError}</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Tip: You can also use physical laser scanners or tap the warehouse simulation barcodes below.
                </p>
              </div>
            </div>
          )}

          {/* Quick Simulation Barcode Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
              <span className="font-semibold">Simulate Scan (Warehouse Test Barcodes):</span>
              <span className="text-[10px]">Tap to test</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleLookup('890123450001')}
                className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono transition border border-stone-200 dark:border-stone-700"
              >
                IR Sensor (890123450001)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('890123450004')}
                className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono transition border border-stone-200 dark:border-stone-700"
              >
                M4 Screws (890123450004)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('890123450002')}
                className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono transition border border-stone-200 dark:border-stone-700"
              >
                Bio Reagent (890123450002)
              </button>
              <button
                type="button"
                onClick={() => handleLookup('CDC-R-A1A')}
                className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-mono transition border border-stone-200 dark:border-stone-700"
              >
                Rack A1A (CDC-R-A1A)
              </button>
            </div>
          </div>

          {/* Manual Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(manualCode);
            }}
            className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-800"
          >
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or enter barcode, SKU, or location tag..."
              className="flex-1 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Resolve</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
