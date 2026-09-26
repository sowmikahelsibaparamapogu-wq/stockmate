import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Clock,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Box,
  Truck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { StatusBadge } from '../common/StatusBadge.tsx';

interface DashboardProps {
  onQuickReorder: (sku: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onQuickReorder, onNavigateTab }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoOrderingSku, setAutoOrderingSku] = useState<string | null>(null);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/dashboard/kpis', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load KPIs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantAutoOrder = async (p: any) => {
    try {
      setAutoOrderingSku(p.sku);
      const res = await fetch('/api/v1/purchase-orders/auto-reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: p.id, sku: p.sku }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to execute auto-reorder');
      }

      const result = await res.json();
      showToast(
        `⚡ Ordered! Added to PO list (${result.purchaseOrder.poNumber}), removed from reorder list, and added to staff receiving dock!`,
        'success'
      );
      // Immediately refresh live KPIs so the item is moved to the Inbound to Staff list
      await fetchKpis();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAutoOrderingSku(null);
    }
  };

  useEffect(() => {
    if (token) fetchKpis();
  }, [token]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-stone-200 dark:bg-stone-800 rounded-lg"></div>
          ))}
        </div>
        <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-lg"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalStock: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
    scheduledTransfers: 0,
    pendingApprovals: 0,
  };

  const kpiCards = [
    {
      title: 'Total Stock Units',
      val: kpis.totalStock.toLocaleString(),
      sub: 'Across all warehouses',
      icon: Box,
      color: 'text-stone-900 dark:text-stone-100',
      action: () => onNavigateTab('products'),
    },
    {
      title: 'Out of Stock',
      val: kpis.outOfStockCount,
      sub: 'Action required immediately',
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400 font-bold',
      badge: kpis.outOfStockCount > 0 ? 'CRITICAL' : undefined,
    },
    {
      title: 'Low Stock Alert',
      val: kpis.lowStockCount,
      sub: 'Below reorder threshold',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Pending Receipts',
      val: kpis.pendingReceipts,
      sub: 'Inbound PO shipments',
      icon: ArrowDownToLine,
      color: 'text-sky-600 dark:text-sky-400',
      action: () => onNavigateTab('operations'),
    },
    {
      title: 'Pending Deliveries',
      val: kpis.pendingDeliveries,
      sub: 'Customer orders to pick',
      icon: ArrowUpFromLine,
      color: 'text-emerald-600 dark:text-emerald-400',
      action: () => onNavigateTab('operations'),
    },
    {
      title: 'Pending Approvals',
      val: kpis.pendingApprovals,
      sub: 'Physical count adjustments',
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
      action: () => onNavigateTab('operations'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Inventory Executive Dashboard
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Real-time live database telemetry, stock levels, and operations status.
          </p>
        </div>
        <button
          onClick={fetchKpis}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Live Data
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={card.action}
              className={`p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs flex flex-col justify-between transition ${
                card.action ? 'cursor-pointer hover:border-red-300 dark:hover:border-red-900' : ''
              }`}
            >
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400 truncate">{card.title}</span>
                <Icon className="w-4 h-4 text-stone-400 shrink-0" />
              </div>
              <div>
                <span className={`text-2xl font-extrabold tracking-tight ${card.color}`}>{card.val}</span>
                {card.badge && (
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    {card.badge}
                  </span>
                )}
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical Section: Direct Out of Stock / Low Stock and Active Inbound to Staff Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Out-of-Stock Urgency Box */}
        <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  Depleted ({data?.outOfStockItems?.length || 0})
                </h3>
              </div>
              <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                Needs Reorder
              </span>
            </div>

            {data?.outOfStockItems?.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto opacity-80" />
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  No unhandled stockouts!
                </p>
                <p className="text-[11px] text-stone-500">
                  Any reordered items have been moved to the Staff Inbound queue.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data?.outOfStockItems?.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-red-200 dark:border-red-900 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{p.name}</p>
                      <p className="text-xs text-stone-500 font-mono">
                        {p.sku} • Threshold: {p.reorderThreshold} {p.unitOfMeasure}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => handleInstantAutoOrder(p)}
                        disabled={autoOrderingSku === p.sku}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {autoOrderingSku === p.sku ? 'Ordering...' : '⚡ Auto-Order'}
                      </button>
                      <button
                        onClick={() => onQuickReorder(p.sku)}
                        title="Open Purchase Order Form with Pre-filled Calculation"
                        className="px-2 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Low Stock ({data?.lowStockItems?.length || 0})
              </h3>
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Approaching Threshold
              </span>
            </div>

            {data?.lowStockItems?.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-6 text-center">
                All inventory items are currently at or above healthy stock levels.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data?.lowStockItems?.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{p.name}</p>
                      <p className="text-xs text-stone-500 font-mono">
                        Current: <span className="font-bold text-amber-600">{p.currentStock}</span> / Min: {p.reorderThreshold}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => handleInstantAutoOrder(p)}
                        disabled={autoOrderingSku === p.sku}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {autoOrderingSku === p.sku ? 'Ordering...' : '⚡ Auto-Order'}
                      </button>
                      <button
                        onClick={() => onQuickReorder(p.sku)}
                        title="Review PO"
                        className="px-2 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ordered & Inbound to Staff Box */}
        <div className="p-5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  Ordered & Inbound to Staff ({data?.orderedInboundItems?.length || 0})
                </h3>
              </div>
              <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                Staff Queue
              </span>
            </div>

            {data?.orderedInboundItems?.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-6 text-center">
                No orders currently pending delivery. After ordering, items move here and into the staff task list.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data?.orderedInboundItems?.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{p.name}</p>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400">
                          {p.openPoNumber}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">
                        Inbound: <strong className="text-sky-600 dark:text-sky-400">+{p.pendingInboundQty} {p.unitOfMeasure}</strong> • Route: Staff Receiving Dock
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => onNavigateTab('suppliers_pos')}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                      >
                        <span>View PO</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movement Velocity & Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Moving Products */}
        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-600" />
            Top Velocity Stock
          </h3>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {data?.topProducts?.length === 0 ? (
              <p className="text-xs text-stone-500 py-4">No movement history yet.</p>
            ) : (
              data?.topProducts?.map((prod: any) => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100 block">{prod.name}</span>
                    <span className="text-stone-500 font-mono">{prod.sku}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
                    Fast Turnover
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow / Dead Stock */}
        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <h3 className="font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-500" />
            Slow / Dormant Stock
          </h3>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {data?.deadStock?.length === 0 ? (
              <p className="text-xs text-stone-500 py-4">No dormant inventory detected.</p>
            ) : (
              data?.deadStock?.slice(0, 5).map((prod: any) => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-stone-900 dark:text-stone-100 block">{prod.name}</span>
                    <span className="text-stone-500 font-mono">{prod.sku}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                    Low Velocity
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unified Movement Ledger Activity Feed */}
        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-600" />
              Live Ledger Activity
            </h3>
            <button
              onClick={() => onNavigateTab('operations')}
              className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1"
            >
              All moves <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {data?.recentMovements?.slice(0, 5).map((m: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-2 rounded bg-stone-50 dark:bg-stone-800/50"
              >
                <div>
                  <span className="font-mono text-stone-500">{m.date}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 ml-2">{m.movementType}</span>
                </div>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {m.totalQty} units
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
