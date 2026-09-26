import React, { useState } from 'react';
import {
  Shield,
  Layers,
  ArrowRight,
  LogIn,
  Building2,
  Sparkles,
  ClipboardList,
  ScanBarcode,
  CheckCircle2,
  Lock,
  Warehouse,
  Boxes,
  Cpu,
  Maximize2,
  X,
  Activity,
  Truck,
  Forklift,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface LoginPortalProps {
  onLoginSuccess?: () => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLoginSuccess }) => {
  const { loginAsDemo, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const [loggingInRole, setLoggingInRole] = useState<'manager' | 'staff' | 'google' | null>(null);
  const [showIndustryPicModal, setShowIndustryPicModal] = useState(false);

  const handleDemoLogin = async (role: 'manager' | 'staff') => {
    try {
      setLoggingInRole(role);
      await loginAsDemo(role);
      showToast(
        `Welcome to StockMate! Signed in as ${role === 'manager' ? 'Chief Inventory Manager' : 'Warehouse Operations Staff'}.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to authenticate demo portal', 'error');
    } finally {
      setLoggingInRole(null);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoggingInRole('google');
      await signInWithGoogle();
      showToast('Signed in successfully with Google account.', 'success');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      showToast(err.message || 'Google authentication failed', 'error');
    } finally {
      setLoggingInRole(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col justify-between overflow-x-hidden selection:bg-red-600 selection:text-white">
      {/* ------------------------------------------------------------------ */}
      {/* Red Aesthetic Warehouse Colorful Background Layer                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Deep ambient red glowing radial meshes */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-red-600/25 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute top-1/3 -right-40 w-[650px] h-[650px] bg-red-700/20 rounded-full blur-[160px]"></div>
        <div className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] bg-rose-900/20 rounded-full blur-[180px]"></div>

        {/* Industrial Warehouse Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, #ef4444 1px, transparent 1px), linear-gradient(to bottom, #ef4444 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        ></div>

        {/* High-Tech Warehouse Architectural Vector Backdrop */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#991b1b" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Isometric warehouse storage racks lines */}
          <line x1="0" y1="200" x2="1920" y2="400" stroke="url(#redGrad)" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="400" x2="1920" y2="600" stroke="url(#redGrad)" strokeWidth="1.5" strokeDasharray="6 6" />
          <line x1="0" y1="600" x2="1920" y2="800" stroke="url(#redGrad)" strokeWidth="1.5" strokeDasharray="6 6" />
          <circle cx="250" cy="300" r="4" fill="#ef4444" />
          <circle cx="650" cy="350" r="4" fill="#ef4444" />
          <circle cx="1150" cy="420" r="4" fill="#ef4444" />
          <circle cx="1650" cy="480" r="4" fill="#ef4444" />
        </svg>

        {/* Subtle illuminated floor spotlight */}
        <div className="absolute bottom-0 inset-x-0 h-96 bg-gradient-to-t from-red-950/40 to-transparent"></div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Top Header & Brand Bar                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-black text-xl shadow-[0_0_24px_rgba(239,68,68,0.5)] border border-red-400/40">
            SM
          </div>
          <div>
            <span className="font-extrabold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2">
              StockMate
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-red-600/30 text-red-400 border border-red-500/40 shadow-xs">
                WMS 2026
              </span>
            </span>
            <p className="text-[11px] text-stone-400 tracking-wide hidden sm:block">
              Enterprise Role-Based Warehouse Management System
            </p>
          </div>
        </div>

        {/* Live Facility Status Beacons */}
        <div className="hidden lg:flex items-center gap-3 text-xs bg-stone-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-800 shadow-sm text-stone-300">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            CDC-01 Central
          </span>
          <span className="text-stone-700">•</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            WBH-02 Westside
          </span>
          <span className="text-stone-700">•</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            NCC-03 Cold-Chain
          </span>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero Intro & Main Dual Portal Selection Area                       */}
      {/* ------------------------------------------------------------------ */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 my-auto space-y-8">
        {/* Hero Title */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-red-400 animate-spin" style={{ animationDuration: '6s' }} />
            Role-Based Terminal Access
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Select Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-300">Warehouse Portal</span>
          </h1>

          <p className="text-sm sm:text-base text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Enter the executive oversight portal or the warehouse floor staff terminal with instant 1-click Demo Logins or authenticated Google credentials.
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* INDUSTRY PICTURE & SMART WAREHOUSE FACILITY SHOWCASE            */}
        {/* ---------------------------------------------------------------- */}
        <div className="rounded-3xl border border-stone-800 bg-stone-900/60 backdrop-blur-md overflow-hidden shadow-2xl relative group">
          {/* Top Bar for Industry Picture */}
          <div className="px-5 py-3 bg-stone-900/90 border-b border-stone-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-stone-300">
              <Warehouse className="w-4 h-4 text-red-500" />
              <span className="font-bold uppercase tracking-wider text-[11px] text-stone-200">
                Facility Overview: Central Distribution Center CDC-01
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono">
                ● 24/7 AUTONOMOUS LOGISTICS
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowIndustryPicModal(true)}
              className="flex items-center gap-1.5 text-stone-400 hover:text-stone-100 text-[11px] font-medium transition px-2 py-1 rounded-md hover:bg-stone-800"
              title="Expand full facility blueprint picture"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Expand Picture</span>
            </button>
          </div>

          {/* Realistic High-Tech Industrial Warehouse Vector Picture */}
          <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden bg-gradient-to-b from-stone-900 via-stone-950 to-black flex items-center justify-center">
            <svg
              className="w-full h-full object-cover"
              viewBox="0 0 1200 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Ceiling ambient light gradient */}
                <linearGradient id="ceilingLight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e1e24" />
                  <stop offset="100%" stopColor="#0c0a09" />
                </linearGradient>

                {/* Warehouse concrete floor with reflections */}
                <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1c1917" />
                  <stop offset="30%" stopColor="#292524" />
                  <stop offset="100%" stopColor="#0c0a09" />
                </linearGradient>

                {/* High bay spotlight cones */}
                <radialGradient id="spotLight1" cx="300" cy="40" r="280" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#fef08a" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="spotLight2" cx="600" cy="40" r="300" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
                  <stop offset="60%" stopColor="#ef4444" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="spotLight3" cx="900" cy="40" r="280" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
                  <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>

                {/* Industrial hazard stripe pattern */}
                <pattern id="hazardStripe" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="20" stroke="#eab308" strokeWidth="8" />
                  <line x1="10" y1="0" x2="10" y2="20" stroke="#1c1917" strokeWidth="8" />
                </pattern>
              </defs>

              {/* Background wall and roof truss structure */}
              <rect x="0" y="0" width="1200" height="280" fill="url(#ceilingLight)" />
              <line x1="0" y1="60" x2="1200" y2="60" stroke="#44403c" strokeWidth="4" />
              <line x1="0" y1="120" x2="1200" y2="120" stroke="#292524" strokeWidth="2" strokeDasharray="12 12" />

              {/* Steel ceiling trusses */}
              {[100, 250, 400, 550, 700, 850, 1000, 1150].map((x, i) => (
                <g key={i}>
                  <line x1={x} y1="0" x2={x} y2="60" stroke="#78716c" strokeWidth="3" />
                  <line x1={x - 60} y1="0" x2={x} y2="60" stroke="#57534e" strokeWidth="1.5" />
                  <line x1={x + 60} y1="0" x2={x} y2="60" stroke="#57534e" strokeWidth="1.5" />
                  {/* High bay lamp fixture */}
                  <rect x={x - 14} y="58" width="28" height="8" rx="2" fill="#d6d3d1" />
                  <ellipse cx={x} cy="66" rx="16" ry="4" fill="#fef08a" />
                </g>
              ))}

              {/* Volumetric spotlight illumination cones onto warehouse floor */}
              <circle cx="300" cy="180" r="260" fill="url(#spotLight1)" />
              <circle cx="600" cy="180" r="280" fill="url(#spotLight2)" />
              <circle cx="900" cy="180" r="260" fill="url(#spotLight3)" />

              {/* Polished concrete warehouse floor */}
              <rect x="0" y="270" width="1200" height="210" fill="url(#floorGrad)" />
              <line x1="0" y1="270" x2="1200" y2="270" stroke="#ef4444" strokeWidth="2" strokeOpacity="0.5" />

              {/* Perspective floor expansion joints */}
              <line x1="600" y1="270" x2="0" y2="480" stroke="#44403c" strokeWidth="1.5" />
              <line x1="600" y1="270" x2="350" y2="480" stroke="#57534e" strokeWidth="2" strokeDasharray="16 16" />
              <line x1="600" y1="270" x2="850" y2="480" stroke="#57534e" strokeWidth="2" strokeDasharray="16 16" />
              <line x1="600" y1="270" x2="1200" y2="480" stroke="#44403c" strokeWidth="1.5" />

              {/* Safety walkway hazard line in foreground */}
              <rect x="420" y="450" width="360" height="16" fill="url(#hazardStripe)" opacity="0.85" rx="3" />

              {/* LEFT RACK TOWER: Multi-Tier High-Bay Industrial Pallet Racking */}
              <g id="leftRack">
                {/* Vertical uprights (safety orange & blue) */}
                <rect x="50" y="90" width="10" height="210" fill="#0284c7" />
                <rect x="180" y="90" width="10" height="210" fill="#0284c7" />
                <rect x="310" y="90" width="10" height="210" fill="#0284c7" />

                {/* Horizontal load beams */}
                {[140, 190, 240, 290].map((y, idx) => (
                  <g key={idx}>
                    <rect x="50" y={y} width="270" height="8" fill="#ea580c" />
                    {/* Pallets on Shelf */}
                    {/* Pallet A */}
                    <rect x="65" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="65" y={y - 36} width="55" height="29" fill="#d97706" rx="2" />
                    <line x1="92" y1={y - 36} x2="92" y2={y - 7} stroke="#92400e" strokeWidth="2" />
                    <rect x="75" y={y - 25} width="16" height="10" fill="#fff" rx="1" />
                    <line x1="78" y1={y - 20} x2="88" y2={y - 20} stroke="#000" strokeWidth="1.5" strokeDasharray="1 1" />

                    {/* Pallet B */}
                    <rect x="135" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="138" y={y - 38} width="49" height="31" fill="#475569" rx="2" />
                    <rect x="142" y={y - 34} width="20" height="24" fill="#334155" rx="1" />
                    <circle cx="170" cy={y - 20} r="4" fill="#ef4444" />

                    {/* Pallet C */}
                    <rect x="205" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="205" y={y - 32} width="55" height="25" fill="#ca8a04" rx="2" />
                  </g>
                ))}
              </g>

              {/* RIGHT RACK TOWER: Automated Storage & Retrieval Racks */}
              <g id="rightRack">
                <rect x="880" y="90" width="10" height="210" fill="#0284c7" />
                <rect x="1010" y="90" width="10" height="210" fill="#0284c7" />
                <rect x="1140" y="90" width="10" height="210" fill="#0284c7" />

                {[140, 190, 240, 290].map((y, idx) => (
                  <g key={idx}>
                    <rect x="880" y={y} width="270" height="8" fill="#ea580c" />
                    {/* Industrial blue drums / containers */}
                    <rect x="895" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="900" y={y - 35} width="22" height="28" rx="4" fill="#2563eb" />
                    <rect x="925" y={y - 35} width="22" height="28" rx="4" fill="#2563eb" />

                    {/* Heavy boxed cartons */}
                    <rect x="965" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="965" y={y - 38} width="55" height="31" fill="#b45309" rx="2" />

                    {/* Bio-cold reagents container */}
                    <rect x="1035" y={y - 7} width="55" height="7" fill="#78350f" rx="1" />
                    <rect x="1035" y={y - 30} width="55" height="23" fill="#0284c7" rx="2" />
                    <circle cx="1062" cy={y - 18} r="5" fill="#38bdf8" />
                  </g>
                ))}
              </g>

              {/* CENTER AISLE: High-Tech Automated Forklift & Autonomous AGV Robot */}
              {/* Automated Guided Vehicle (AGV) Robot */}
              <g id="agvRobot" transform="translate(540, 310)">
                {/* AGV Chassis */}
                <rect x="0" y="40" width="120" height="34" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                {/* Safety Flashing Beacon */}
                <circle cx="60" cy="36" r="6" fill="#f59e0b" />
                <circle cx="60" cy="36" r="10" fill="#f59e0b" opacity="0.3" />
                {/* Wheels */}
                <rect x="12" y="70" width="24" height="10" rx="3" fill="#0f172a" />
                <rect x="84" y="70" width="24" height="10" rx="3" fill="#0f172a" />
                {/* Loaded Pallet with Laser Scan Barcode */}
                <rect x="15" y="32" width="90" height="8" fill="#78350f" rx="1" />
                <rect x="18" y="-5" width="84" height="37" fill="#e2e8f0" rx="2" />
                {/* Barcode label on freight */}
                <rect x="35" y="10" width="50" height="16" fill="#ffffff" rx="1" />
                <line x1="40" y1="18" x2="75" y2="18" stroke="#0f172a" strokeWidth="2" strokeDasharray="3 2" />
                {/* Animated Laser Scanning Beam */}
                <line x1="10" y1="18" x2="110" y2="18" stroke="#ef4444" strokeWidth="2" strokeOpacity="0.8" />
                <ellipse cx="60" cy="18" rx="45" ry="3" fill="#ef4444" opacity="0.25" />
                {/* Front LiDAR Sensor */}
                <rect x="100" y="48" width="16" height="8" rx="2" fill="#0284c7" />
                <circle cx="112" cy="52" r="2.5" fill="#38bdf8" />
              </g>

              {/* Forklift Reach Truck Profile in background aisle */}
              <g id="forkliftReach" transform="translate(420, 240)">
                <rect x="0" y="30" width="60" height="30" rx="4" fill="#f59e0b" />
                <rect x="10" y="5" width="30" height="30" rx="3" fill="none" stroke="#f59e0b" strokeWidth="3" />
                {/* Mast */}
                <rect x="55" y="-30" width="6" height="90" fill="#334155" />
                <rect x="61" y="10" width="20" height="4" fill="#64748b" />
                {/* Wheels */}
                <circle cx="15" cy="62" r="8" fill="#0f172a" />
                <circle cx="50" cy="62" r="8" fill="#0f172a" />
                {/* Warning amber light */}
                <circle cx="25" cy="2" r="3" fill="#ef4444" />
              </g>

              {/* Real-Time Optical Barcode Scanner Grid Reticle */}
              <g id="scannerGrid" opacity="0.7">
                <line x1="600" y1="160" x2="600" y2="340" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="600" cy="250" r="40" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 4" fill="none" />
                <rect x="590" y="240" width="20" height="20" stroke="#ef4444" strokeWidth="1.5" fill="none" />
                <text x="615" y="245" fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">SM-SCAN: OK</text>
              </g>
            </svg>

            {/* Live Facility Telemetry Overlay Badges */}
            <div className="absolute top-3 left-4 flex flex-wrap items-center gap-2 pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-stone-900/90 text-stone-200 border border-stone-700/80 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <Activity className="w-3 h-3 text-red-500 animate-pulse" />
                HIGH-BAY STORAGE: 94.2% ACTIVE
              </span>
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-stone-900/90 text-stone-200 border border-stone-700/80 text-[10px] font-mono font-bold items-center gap-1.5 shadow-sm">
                <Truck className="w-3 h-3 text-sky-400" />
                DOCK BAYS 1-4: READY
              </span>
            </div>

            <div className="absolute bottom-3 right-4 pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-red-950/80 text-red-300 border border-red-700/60 text-[10px] font-mono font-bold shadow-sm">
                AUTOMATED INVENTORY TRACKING • 2026
              </span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TWO SEPARATE PORTALS (MANAGER VS STAFF)                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* PORTAL 1: INVENTORY MANAGER PORTAL */}
          <div className="group relative rounded-3xl bg-gradient-to-b from-stone-900/90 to-stone-900/60 backdrop-blur-xl border border-red-900/40 hover:border-red-500/60 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(239,68,68,0.15)] hover:shadow-[0_20px_40px_-10px_rgba(239,68,68,0.3)]">
            <div className="space-y-6">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-red-950/90 text-red-400 border border-red-800/80 shadow-xs flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  Executive Control
                </span>
                <span className="text-xs font-mono text-stone-500">PORTAL #01</span>
              </div>

              {/* Portal Info */}
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30 shadow-inner group-hover:scale-105 transition">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Inventory Manager Portal
                </h2>
              </div>
            </div>

            {/* Manager Demo Login Action */}
            <div className="pt-8 space-y-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('manager')}
                disabled={loggingInRole !== null}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-sm font-bold transition shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 group/btn disabled:opacity-50 cursor-pointer"
              >
                {loggingInRole === 'manager' ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Authenticating Manager...
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Demo Login as Inventory Manager</span>
                    <ArrowRight className="w-4 h-4 transition group-hover/btn:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PORTAL 2: WAREHOUSE STAFF FLOOR TERMINAL */}
          <div className="group relative rounded-3xl bg-gradient-to-b from-stone-900/90 to-stone-900/60 backdrop-blur-xl border border-sky-900/40 hover:border-sky-500/60 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(14,165,233,0.15)] hover:shadow-[0_20px_40px_-10px_rgba(14,165,233,0.3)]">
            <div className="space-y-6">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-950/90 text-sky-400 border border-sky-800/80 shadow-xs flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-sky-400" />
                  Floor Terminal
                </span>
                <span className="text-xs font-mono text-stone-500">PORTAL #02</span>
              </div>

              {/* Portal Info */}
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-600/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shadow-inner group-hover:scale-105 transition">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Warehouse Staff Portal
                </h2>
              </div>
            </div>

            {/* Staff Demo Login Action */}
            <div className="pt-8 space-y-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('staff')}
                disabled={loggingInRole !== null}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl text-sm font-bold transition shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center gap-2 group/btn disabled:opacity-50 cursor-pointer"
              >
                {loggingInRole === 'staff' ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Authenticating Staff...
                  </span>
                ) : (
                  <>
                    <ScanBarcode className="w-4 h-4 text-sky-200" />
                    <span>Demo Login as Warehouse Staff</span>
                    <ArrowRight className="w-4 h-4 transition group-hover/btn:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Unified Google Account Authentication Alternative               */}
        {/* ---------------------------------------------------------------- */}
        <div className="pt-2 text-center space-y-4">
          <div className="flex items-center justify-center gap-3 text-xs text-stone-500">
            <span className="h-px bg-stone-800 w-24"></span>
            <span>OR CONNECT WITH GOOGLE AUTH</span>
            <span className="h-px bg-stone-800 w-24"></span>
          </div>

          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loggingInRole !== null}
              className="w-full py-3 px-4 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-200 text-xs font-semibold transition flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-stone-400" />
              <span>Sign In with Google Account (Role Assigned Automatically)</span>
            </button>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* POPUP MODAL: Expanded High-Resolution Industry Picture View        */}
      {/* ------------------------------------------------------------------ */}
      {showIndustryPicModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setShowIndustryPicModal(false)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 cursor-default relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Prominent Exit Cross Option */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Central Distribution Center CDC-01 • Industrial Facility Picture
                  </h3>
                  <p className="text-xs text-stone-400">
                    High-bay automated pallet racking, autonomous guided vehicles, and digital receiving docks
                  </p>
                </div>
              </div>
              {/* Prominent Cross Button to Exit */}
              <button
                type="button"
                onClick={() => setShowIndustryPicModal(false)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white border border-stone-700 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Picture Illustration */}
            <div className="rounded-2xl border border-stone-800 overflow-hidden bg-black/60 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
                <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block">Facility Area</span>
                  <span className="font-mono font-bold text-white text-sm">45,000 m² Footprint</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block">Storage Capacity</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">18,500 Pallet Positions</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block">Cold Chain Chamber</span>
                  <span className="font-mono font-bold text-sky-400 text-sm">-20°C to +4°C Certified</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 space-y-2">
                <p className="leading-relaxed">
                  The StockMate smart terminal interconnects directly with CDC-01's automated racking systems, supporting barcode optical scanning, double-entry inventory ledger synchronization, automated replenishment thresholds, and multi-role operational validation.
                </p>
              </div>
            </div>

            {/* Modal Bottom Exit Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowIndustryPicModal(false)}
                className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-stone-700"
              >
                <X className="w-4 h-4" />
                <span>Exit Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Bottom Footer Info                                                 */}
      {/* ------------------------------------------------------------------ */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-stone-600 border-t border-stone-900 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-stone-500">
          <Lock className="w-3.5 h-3.5 text-stone-500" />
          <span>Role-Based Access Control • Double-Entry PostgreSQL Movement Ledger</span>
        </div>
        <p className="text-stone-600">
          StockMate Intelligent Warehouse Management System • 2026 Edition
        </p>
      </footer>
    </div>
  );
};

