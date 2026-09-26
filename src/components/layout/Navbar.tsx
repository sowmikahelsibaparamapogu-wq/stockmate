import React, { useState } from 'react';
import {
  Package,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  Building2,
  BarChart3,
  Bell,
  UserCheck,
  ClipboardList,
  ScanBarcode,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  X,
  Play,
  ArrowRight,
  Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  unreadCount?: number;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  unreadCount = 0,
  onRefreshData,
}) => {
  const { token, dbUser, activeRole, switchRole, signOut } = useAuth();
  const { theme, toggleTheme, showToast } = useToast();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isManager = activeRole === 'manager';

  const handleResetDemoData = async () => {
    try {
      setIsResetting(true);
      const res = await fetch('/api/v1/demo/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset demo dataset');
      }

      showToast('Demo dataset reset! Fresh receipts, DOs, transfers & adjustments ready.', 'success');
      setShowDemoModal(false);
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const executeDemoJump = (targetRole: 'manager' | 'staff', targetTab: string) => {
    if (activeRole !== targetRole) {
      switchRole(targetRole);
    }
    setCurrentTab(targetTab);
    setShowDemoModal(false);
  };

  const managerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'suppliers_pos', label: 'Suppliers & POs', icon: Layers },
    { id: 'operations', label: 'Operations', icon: SlidersHorizontal },
    { id: 'warehouses_staff', label: 'Warehouses & Staff', icon: Building2 },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  const staffNavItems = [
    { id: 'staff_tasks', label: 'My Tasks', icon: ClipboardList },
    { id: 'staff_receipts', label: 'Receipts', icon: ArrowDownToLine },
    { id: 'staff_deliveries', label: 'Delivery Orders', icon: ArrowUpFromLine },
    { id: 'staff_transfers', label: 'Transfers', icon: ArrowLeftRight },
    { id: 'staff_stock_count', label: 'Stock Count', icon: SlidersHorizontal },
    { id: 'staff_scan', label: 'Barcode Scan', icon: ScanBarcode },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  const navItems = isManager ? managerNavItems : staffNavItems;

  return (
    <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 sticky top-0 z-40">
      {/* Top Banner & Profile Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-black tracking-wider shadow-sm">
              SS
            </div>
            <div>
              <span className="font-bold text-lg text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-1.5">
                StockSense
                <span className="text-xs uppercase font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                  {isManager ? 'Manager Portal' : 'Warehouse Staff'}
                </span>
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Demo Operations & Reset button */}
            <button
              onClick={() => setShowDemoModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold transition shadow-2xs"
              title="View all loaded demo data and available operations"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Demo Operations</span>
              <span className="md:hidden">Demo</span>
            </button>

            {/* Quick Reset Demo Data Icon Button */}
            <button
              onClick={handleResetDemoData}
              disabled={isResetting}
              className="p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-semibold border border-stone-200 dark:border-stone-700 transition"
              title="Reset Demo Dataset to initial state"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-red-600' : ''}`} />
              <span className="hidden lg:inline">{isResetting ? 'Resetting...' : 'Reset Demo'}</span>
            </button>

            {/* Quick Role Switcher Pill */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-1 border border-stone-200 dark:border-stone-700 text-xs font-medium">
              <button
                type="button"
                onClick={() => switchRole('manager')}
                className={`px-2.5 py-1 rounded-md transition ${
                  isManager
                    ? 'bg-red-600 text-white font-semibold shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => switchRole('staff')}
                className={`px-2.5 py-1 rounded-md transition ${
                  !isManager
                    ? 'bg-red-600 text-white font-semibold shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Staff
              </button>
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Dark Mode"
              className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition border border-stone-200 dark:border-stone-700"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
            </button>

            {/* User Info / Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200 leading-tight">
                  {dbUser?.name || 'Staff User'}
                </p>
                <p className="text-[10px] text-stone-500 capitalize">{dbUser?.email || ''}</p>
              </div>

              <button
                onClick={signOut}
                title="Sign out"
                className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-stone-100 dark:border-stone-800/80 overflow-x-auto">
        <nav className="flex space-x-1 py-1.5 min-w-max" aria-label="Tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition relative ${
                  isActive
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200/60 dark:border-red-900/60'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Demo Operations Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                    StockSense Demo Data & Operational Workflows
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Rich scenarios loaded in PostgreSQL ready for immediate execution and testing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scenarios Grid */}
            <div className="space-y-3">
              {/* Scenario 1: Auto-Reorder */}
              <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                      Out of Stock
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      1-Click Instant Auto-Reorder
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    <strong className="text-stone-800 dark:text-stone-200">M4 Stainless Hex Screws</strong> is at 0 units. Test the 1-click replenishment algorithm with safety stock computation.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('manager', 'dashboard')}
                  className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  Test Auto-Order
                </button>
              </div>

              {/* Scenario 2: Inbound Goods Receiving */}
              <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                      Inbound Dock
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Goods Receipt Inspection & Putaway
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Receipt <strong className="text-stone-800 dark:text-stone-200">REC-2026-0001</strong> is waiting at Central Dock (30 Sensors & 50 Screws). Validate putaway into storage rack.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('staff', 'staff_receipts')}
                  className="shrink-0 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Staff Receipts
                </button>
              </div>

              {/* Scenario 3: Outbound Delivery Pick & Pack */}
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      Outbound Shipping
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Delivery Order Picking & Dispatch
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Order <strong className="text-stone-800 dark:text-stone-200">DO-2026-0001</strong> for AeroDynamics SG is ready. Pick items, test shortage flag, and dispatch freight.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('staff', 'staff_deliveries')}
                  className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Staff Deliveries
                </button>
              </div>

              {/* Scenario 4: Internal Relocation Transfer */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Internal Move
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Warehouse Stock Transfer
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Transfer <strong className="text-stone-800 dark:text-stone-200">TRF-2026-0001</strong> moves 15 shipping cartons from Rack A-01-A to Dispatch Bay 1.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('staff', 'staff_transfers')}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Staff Transfers
                </button>
              </div>

              {/* Scenario 5: Manager Discrepancy Approval */}
              <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      Audit Review
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Stock Count Variance Review & Approval
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Adjustment <strong className="text-stone-800 dark:text-stone-200">ADJ-2026-0001</strong> has a -5 unit variance submitted by staff. Manager can review audit comment & approve.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('manager', 'operations')}
                  className="shrink-0 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Review Adjustment
                </button>
              </div>

              {/* Scenario 6: Barcode Scanner Terminal */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300">
                      Scanner
                    </span>
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      Barcode Scanner & Instant Telemetry
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Scan or enter barcode <code className="px-1 py-0.5 bg-stone-200 dark:bg-stone-700 rounded text-[11px] font-mono">890123450001</code> or SKU <code className="px-1 py-0.5 bg-stone-200 dark:bg-stone-700 rounded text-[11px] font-mono">SKU-IND-4001</code> to view location breakdown.
                  </p>
                </div>
                <button
                  onClick={() => executeDemoJump('staff', 'staff_scan')}
                  className="shrink-0 px-3 py-1.5 bg-stone-800 hover:bg-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Open Scanner
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                You can execute and complete any operation, then reset anytime.
              </span>
              <button
                onClick={handleResetDemoData}
                disabled={isResetting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting Demo Data...' : 'Reset to Fresh Demo Dataset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
