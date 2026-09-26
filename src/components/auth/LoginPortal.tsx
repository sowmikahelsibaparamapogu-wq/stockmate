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

  const handleDemoLogin = async (role: 'manager' | 'staff') => {
    try {
      setLoggingInRole(role);
      await loginAsDemo(role);
      showToast(
        `Welcome to StockSense! Signed in as ${role === 'manager' ? 'Chief Inventory Manager' : 'Warehouse Operations Staff'}.`,
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
            SS
          </div>
          <div>
            <span className="font-extrabold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2">
              StockSense
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
      <main className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 my-auto space-y-10">
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
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  High-level executive KPIs, supplier replenishments, automatic purchase orders, physical count variance approvals, and complete PostgreSQL valuation ledger.
                </p>
              </div>

              {/* Core Features Pill List */}
              <div className="space-y-2 pt-2 border-t border-stone-800/80 text-xs text-stone-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Real-time Financial Inventory Valuation & Margin Telemetry</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                  <span>1-Click Replenishment for Out-of-Stock Items</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Cycle Count Discrepancy Approvals & Audit Trails</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Multi-Warehouse & Cross-Zone Location Management</span>
                </div>
              </div>
            </div>

            {/* Manager Demo Login Action */}
            <div className="pt-8 space-y-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('manager')}
                disabled={loggingInRole !== null}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-sm font-bold transition shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 group/btn disabled:opacity-50"
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
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  Optimized for handheld and tablet floor operations: dock receiving inspections, delivery order picking and packaging, internal relocations, and optical barcode scanning.
                </p>
              </div>

              {/* Core Features Pill List */}
              <div className="space-y-2 pt-2 border-t border-stone-800/80 text-xs text-stone-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Inbound Dock Receiving, Lot Tracking & Putaway</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Outbound Order Pick & Pack with Shortage Flagging</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Physical Inventory Counting & Discrepancy Reporting</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Live Camera Barcode Scanner & Instant Tag Resolver</span>
                </div>
              </div>
            </div>

            {/* Staff Demo Login Action */}
            <div className="pt-8 space-y-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('staff')}
                disabled={loggingInRole !== null}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl text-sm font-bold transition shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center gap-2 group/btn disabled:opacity-50"
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
        <div className="pt-4 text-center space-y-4">
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
              className="w-full py-3 px-4 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-200 text-xs font-semibold transition flex items-center justify-center gap-2.5 shadow-sm"
            >
              <LogIn className="w-4 h-4 text-stone-400" />
              <span>Sign In with Google Account (Role Assigned Automatically)</span>
            </button>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom Footer Info                                                 */}
      {/* ------------------------------------------------------------------ */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-stone-600 border-t border-stone-900 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-stone-500">
          <Lock className="w-3.5 h-3.5 text-stone-500" />
          <span>Role-Based Access Control • Double-Entry PostgreSQL Movement Ledger</span>
        </div>
        <p className="text-stone-600">
          StockSense Intelligent Warehouse Management System • 2026 Edition
        </p>
      </footer>
    </div>
  );
};
