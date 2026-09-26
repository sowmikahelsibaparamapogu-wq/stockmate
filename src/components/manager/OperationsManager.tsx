import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Layers,
  Search,
  Plus,
  X,
  AlertCircle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { DocumentCommentThread } from '../common/DocumentCommentThread.tsx';

export const OperationsManager: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<
    'receipts' | 'deliveries' | 'transfers' | 'adjustments' | 'ledger' | 'returns'
  >('receipts');

  const [receipts, setReceipts] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Two-way Document Notes & Discussion Modal
  const [activeDocComment, setActiveDocComment] = useState<{
    type: 'receipt' | 'delivery' | 'transfer' | 'adjustment';
    id: string;
    warehouseId?: number;
  } | null>(null);

  // New Delivery Modal
  const [isDoModalOpen, setIsDoModalOpen] = useState(false);
  const [doForm, setDoForm] = useState({
    warehouseId: '',
    customerName: '',
    shippingAddress: '',
    notes: '',
    lines: [
      {
        productId: '',
        locationId: '',
        orderedQty: 1,
      },
    ],
  });

  // Returns Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    returnType: 'CUSTOMER_RETURN', // or SUPPLIER_RETURN
    productId: '',
    warehouseId: '',
    locationId: '',
    quantity: 1,
    referenceDoc: '',
    reason: 'Damaged item replacement or customer refund',
  });

  // Review Adjustment Modal
  const [reviewModalData, setReviewModalData] = useState<any | null>(null);
  const [managerComment, setManagerComment] = useState('');

  // Form Presets Handlers
  const applyDoPreset = (type: 'priority' | 'retail') => {
    const whId = warehouses[0]?.id?.toString() || '1';
    const prod = products[0];
    if (type === 'priority') {
      setDoForm({
        warehouseId: whId,
        customerName: 'TechCorp Enterprise Solutions SG',
        shippingAddress: '88 Marina Bay Sands Blvd, Floor 14, Singapore 018956',
        notes: 'Priority Customer Order - Express picking & dispatch requested.',
        lines: [
          {
            productId: prod ? String(prod.id) : '1',
            locationId: '',
            orderedQty: 12,
          },
        ],
      });
      showToast('Loaded preset: "🚚 Priority B2B Delivery"');
    } else {
      const prod2 = products[1] || products[0];
      setDoForm({
        warehouseId: whId,
        customerName: 'Metro Department Store #04',
        shippingAddress: '435 Orchard Road, Loading Bay B, Singapore 238877',
        notes: 'Weekly store replenishment batch.',
        lines: [
          {
            productId: prod2 ? String(prod2.id) : '1',
            locationId: '',
            orderedQty: 30,
          },
        ],
      });
      showToast('Loaded preset: "🏬 Retail Depot Restock"');
    }
  };

  const applyReturnPreset = (type: 'customer' | 'supplier') => {
    const whId = warehouses[0]?.id?.toString() || '1';
    const prod = products[0];
    if (type === 'customer') {
      setReturnForm({
        returnType: 'CUSTOMER_RETURN',
        productId: prod ? String(prod.id) : '1',
        warehouseId: whId,
        locationId: '',
        quantity: 2,
        referenceDoc: `RET-CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        reason: 'Customer reported minor cosmetic packaging damage; returned for credit.',
      });
      showToast('Loaded preset: "📦 Customer Return"');
    } else {
      setReturnForm({
        returnType: 'SUPPLIER_RETURN',
        productId: prod ? String(prod.id) : '1',
        warehouseId: whId,
        locationId: '',
        quantity: 5,
        referenceDoc: `RMA-VEND-${Math.floor(1000 + Math.random() * 9000)}`,
        reason: 'Inbound lot failed QC inspection tolerance. RMA issued to supplier.',
      });
      showToast('Loaded preset: "🔄 Supplier RMA Return"');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, dRes, tRes, aRes, lRes, wRes, pRes] = await Promise.all([
        fetch('/api/v1/receipts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/delivery-orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/transfers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/adjustments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/stock-ledger', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/products', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (rRes.ok) setReceipts(await rRes.json());
      if (dRes.ok) setDeliveries(await dRes.json());
      if (tRes.ok) setTransfers(await tRes.json());
      if (aRes.ok) setAdjustments(await aRes.json());
      if (lRes.ok) setLedger(await lRes.json());
      if (wRes.ok) setWarehouses(await wRes.json());
      if (pRes.ok) setProducts(await pRes.json());
    } catch (e: any) {
      showToast(e.message || 'Error loading operations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Global Escape key listener to exit any open popup / modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reviewModalData) setReviewModalData(null);
        else if (isDoModalOpen) setIsDoModalOpen(false);
        else if (isReturnModalOpen) setIsReturnModalOpen(false);
        else if (activeDocComment) setActiveDocComment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewModalData, isDoModalOpen, isReturnModalOpen, activeDocComment]);

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/delivery-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(doForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create delivery order');
      }

      showToast('Delivery order created and assigned to warehouse picking queue.');
      setIsDoModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleReviewAdjustment = async (action: 'APPROVE' | 'REJECT') => {
    if (!reviewModalData) return;
    try {
      const res = await fetch(`/api/v1/adjustments/${reviewModalData.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, managerComment }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process adjustment review');
      }

      showToast(action === 'APPROVE' ? 'Stock count adjustment approved and applied!' : 'Adjustment rejected.');
      setReviewModalData(null);
      setManagerComment('');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(returnForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process return');
      }

      showToast('Return transaction logged and inventory adjusted.');
      setIsReturnModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Operations & Movement Control
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Inbound Receipts, Outbound Deliveries, Internal Transfers, Physical Adjustments, and Unified Ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const wh = warehouses[0];
              const loc = wh?.locations?.[0];
              const p = products[0];
              setReturnForm({
                returnType: 'CUSTOMER_RETURN',
                productId: p?.id ? String(p.id) : '',
                warehouseId: wh?.id ? String(wh.id) : '',
                locationId: loc?.id ? String(loc.id) : '',
                quantity: 1,
                referenceDoc: `RET-${Date.now().toString().slice(-4)}`,
                reason: 'Customer RMA return',
              });
              setIsReturnModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Process Return
          </button>

          <button
            onClick={() => {
              const wh = warehouses[0];
              const loc = wh?.locations?.[0];
              const p = products[0];
              setDoForm({
                warehouseId: wh?.id ? String(wh.id) : '',
                customerName: 'Enterprise Client',
                shippingAddress: '45 Pioneer Sector 2, SG',
                notes: 'Standard priority shipment',
                lines: [
                  {
                    productId: p?.id ? String(p.id) : '',
                    locationId: loc?.id ? String(loc.id) : '',
                    orderedQty: 5,
                  },
                ],
              });
              setIsDoModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Delivery Order
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="border-b border-stone-200 dark:border-stone-800 flex space-x-4 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'receipts', label: 'Inbound Receipts', icon: ArrowDownToLine, count: receipts.length },
          { id: 'deliveries', label: 'Outbound Deliveries', icon: ArrowUpFromLine, count: deliveries.length },
          { id: 'transfers', label: 'Internal Transfers', icon: ArrowLeftRight, count: transfers.length },
          {
            id: 'adjustments',
            label: 'Stock Adjustments (Audit)',
            icon: SlidersHorizontal,
            count: adjustments.filter((a) => a.status === 'Waiting').length,
          },
          { id: 'ledger', label: 'Move History (Unified Ledger)', icon: History, count: ledger.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium transition ${
                isActive
                  ? 'border-red-600 text-red-600 dark:text-red-400 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {Boolean(tab.count && tab.count > 0) && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    tab.id === 'adjustments' && tab.count > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 font-bold'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub Tab: Receipts */}
      {activeSubTab === 'receipts' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Receipt Ref</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Source PO</th>
                  <th className="py-3 px-4">Products & Quantities</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Validation Date</th>
                  <th className="py-3 px-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {rec.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4">{rec.warehouse?.name || 'CDC-01'}</td>
                    <td className="py-3.5 px-4 font-mono text-stone-500">{rec.sourceDocument || 'Direct'}</td>
                    <td className="py-3.5 px-4">
                      {rec.lines?.map((line: any) => (
                        <div key={line.id} className="text-[11px]">
                          <span className="font-semibold text-stone-800 dark:text-stone-200">{line.product?.name}</span>
                          <span className="text-stone-500 ml-1">
                            ({line.receivedQty} / {line.expectedQty} rec.) @ {line.location?.name}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-400">
                      {rec.validatedAt ? new Date(rec.validatedAt).toLocaleString() : 'Pending Staff Receiving'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDocComment({
                            type: 'receipt',
                            id: rec.receiptNumber,
                            warehouseId: rec.warehouseId,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-red-50 dark:bg-stone-800 dark:hover:bg-red-950/40 text-stone-700 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 font-semibold text-xs border border-stone-200 dark:border-stone-700 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                        <span>Notes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Deliveries */}
      {activeSubTab === 'deliveries' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">DO Ref</th>
                  <th className="py-3 px-4">Customer & Address</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Items Ordered / Picked</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dispatch Timestamp</th>
                  <th className="py-3 px-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {d.doNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold block text-stone-800 dark:text-stone-200">{d.customerName}</span>
                      <span className="text-[10px] text-stone-400">{d.shippingAddress}</span>
                    </td>
                    <td className="py-3.5 px-4">{d.warehouse?.name}</td>
                    <td className="py-3.5 px-4">
                      {d.lines?.map((line: any) => (
                        <div key={line.id} className="text-[11px]">
                          <span className="font-semibold text-stone-800 dark:text-stone-200">{line.product?.name}</span>
                          <span className="text-stone-500 ml-1">
                            ({line.pickedQty} / {line.orderedQty} picked)
                          </span>
                          {line.isOutOfStockFlagged && (
                            <span className="ml-1 text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950 px-1 py-0.2 rounded">
                              Flagged OOS
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-400">
                      {d.validatedAt ? new Date(d.validatedAt).toLocaleString() : 'Ready for Pick & Pack'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDocComment({
                            type: 'delivery',
                            id: d.doNumber,
                            warehouseId: d.warehouseId,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-red-50 dark:bg-stone-800 dark:hover:bg-red-950/40 text-stone-700 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 font-semibold text-xs border border-stone-200 dark:border-stone-700 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                        <span>Notes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Internal Transfers */}
      {activeSubTab === 'transfers' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Transfer Number</th>
                  <th className="py-3 px-4">From Location</th>
                  <th className="py-3 px-4">To Location</th>
                  <th className="py-3 px-4">Product & Qty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Completed Date</th>
                  <th className="py-3 px-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {t.transferNumber}
                    </td>
                    <td className="py-3.5 px-4">{t.fromLocation?.name}</td>
                    <td className="py-3.5 px-4">{t.toLocation?.name}</td>
                    <td className="py-3.5 px-4">
                      {t.lines?.map((line: any) => (
                        <div key={line.id}>
                          {line.product?.name}: <span className="font-bold">{line.quantity} units</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-400">
                      {t.validatedAt ? new Date(t.validatedAt).toLocaleString() : 'In Transit'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDocComment({
                            type: 'transfer',
                            id: t.transferNumber,
                            warehouseId: t.warehouseId,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-red-50 dark:bg-stone-800 dark:hover:bg-red-950/40 text-stone-700 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 font-semibold text-xs border border-stone-200 dark:border-stone-700 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                        <span>Notes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Stock Adjustments (Approvals & Physical Counts) */}
      {activeSubTab === 'adjustments' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                Physical Stock Counts & Variance Adjustments
              </h3>
              <p className="text-xs text-stone-500">
                Discrepancies reported by warehouse staff requiring managerial review before ledger mutation.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Adjustment ID</th>
                  <th className="py-3 px-4">Warehouse & Location</th>
                  <th className="py-3 px-4">Reason & Staff Comments</th>
                  <th className="py-3 px-4">Variances Counted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {a.adjustmentNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium block">{a.warehouse?.name}</span>
                      <span className="text-[10px] text-stone-400">{a.location?.name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-stone-800 dark:text-stone-200 block">{a.reason}</span>
                      <span className="text-[11px] text-stone-500 italic">"{a.staffComment || 'No notes'}"</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {a.lines?.map((line: any) => (
                        <div key={line.id} className="text-[11px] font-mono">
                          <span className="font-semibold text-stone-800 dark:text-stone-200">{line.product?.name}: </span>
                          <span>Sys {line.recordedQty} → Counted {line.countedQty} </span>
                          <span
                            className={`font-bold ${
                              line.varianceQty < 0 ? 'text-red-600' : line.varianceQty > 0 ? 'text-emerald-600' : 'text-stone-500'
                            }`}
                          >
                            ({line.varianceQty > 0 ? `+${line.varianceQty}` : line.varianceQty})
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDocComment({
                              type: 'adjustment',
                              id: a.adjustmentNumber,
                              warehouseId: a.warehouseId,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-red-50 dark:bg-stone-800 dark:hover:bg-red-950/40 text-stone-700 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 font-semibold text-xs border border-stone-200 dark:border-stone-700 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                          <span>Notes</span>
                        </button>
                        {a.status === 'Waiting' ? (
                          <button
                            onClick={() => {
                              setReviewModalData(a);
                              setManagerComment('');
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            Review & Decide
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-400">
                            {a.managerComment || 'Reviewed'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab: Unified Stock Ledger (Move History) */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                Unified Stock Ledger (Audit Trail)
              </h3>
              <p className="text-xs text-stone-500">
                Immutable chronological log of all stock increments, decrements, and transfers.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Product & SKU</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Reference Doc</th>
                  <th className="py-3 px-4">Warehouse & Location</th>
                  <th className="py-3 px-4">Quantity Change</th>
                  <th className="py-3 px-4">New Balance</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
                {ledger.map((entry) => (
                  <tr key={entry.ledger.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                      {new Date(entry.ledger.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-semibold text-stone-900 dark:text-stone-100">
                      {entry.product?.name}
                      <span className="block text-[10px] text-stone-400 font-mono">{entry.product?.sku}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[10px] font-bold">
                        {entry.ledger.movementType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-stone-800 dark:text-stone-200">
                      {entry.ledger.documentReference}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      {entry.warehouse?.name} - {entry.location?.name}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span
                        className={
                          entry.ledger.quantityChange > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {entry.ledger.quantityChange > 0 ? `+${entry.ledger.quantityChange}` : entry.ledger.quantityChange}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-stone-100">
                      {entry.ledger.newBalance}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-stone-500">
                      {entry.user?.name || 'System Operator'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Review Adjustment */}
      {reviewModalData && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setReviewModalData(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                Review Adjustment {reviewModalData.adjustmentNumber}
              </h3>
              <button
                onClick={() => setReviewModalData(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-lg">
                <p className="font-semibold text-stone-800 dark:text-stone-200">
                  Reason: {reviewModalData.reason}
                </p>
                <p className="text-stone-500 mt-1">Staff Notes: "{reviewModalData.staffComment || 'None'}"</p>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-2">Item Variances:</label>
                <div className="divide-y divide-stone-100 dark:divide-stone-800 border rounded-lg border-stone-200 dark:border-stone-700 p-2">
                  {reviewModalData.lines?.map((line: any) => (
                    <div key={line.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-stone-900 dark:text-stone-100 block">
                          {line.product?.name}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">{line.product?.sku}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-stone-500">Sys: {line.recordedQty} → Count: {line.countedQty}</span>
                        <span
                          className={`block font-bold ${
                            line.varianceQty < 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          Delta: {line.varianceQty > 0 ? `+${line.varianceQty}` : line.varianceQty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Manager Comment / Reason for Audit Record *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setManagerComment('Physical shelf stock discrepancy verified against shift cycle audit sheet. Approved.')
                    }
                    className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-700 dark:text-stone-300 hover:border-red-400 border border-stone-200 dark:border-stone-700"
                  >
                    ✅ Verified & Count Validated
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setManagerComment('Carton crushed during dock staging. Scrapped and updated on ledger.')
                    }
                    className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-700 dark:text-stone-300 hover:border-red-400 border border-stone-200 dark:border-stone-700"
                  >
                    ⚠️ Damaged Goods Scrapped
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setManagerComment('Discrepancy is abnormally high. Rejected and ordered 2nd shift recount.')
                    }
                    className="px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-700 dark:text-stone-300 hover:border-red-400 border border-stone-200 dark:border-stone-700"
                  >
                    ❌ Recount Mandated
                  </button>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Verified shrinkage after recount; approved write-off."
                  value={managerComment}
                  onChange={(e) => setManagerComment(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Live Staff / Manager Comment Thread */}
              <div className="pt-2">
                <DocumentCommentThread
                  documentType="adjustment"
                  documentId={reviewModalData.adjustmentNumber}
                  warehouseId={reviewModalData.warehouseId}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => handleReviewAdjustment('REJECT')}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-bold"
              >
                Reject Adjustment
              </button>
              <button
                type="button"
                onClick={() => handleReviewAdjustment('APPROVE')}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                Approve & Apply to Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Delivery Order */}
      {isDoModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsDoModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">Create Outbound Delivery Order</h3>
                <p className="text-xs text-stone-500">Dispatch stock for customer shipment or cross-dock delivery</p>
              </div>
              <button
                onClick={() => setIsDoModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery Order Presets */}
            <div className="mt-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick DO Presets (1-Click Fill):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDoPreset('priority')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🚚 Priority B2B Fulfillment
                </button>
                <button
                  type="button"
                  onClick={() => applyDoPreset('retail')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🏬 Retail Chain Restock
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateDelivery} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Source Warehouse *</label>
                <select
                  required
                  value={doForm.warehouseId}
                  onChange={(e) => setDoForm({ ...doForm, warehouseId: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={doForm.customerName}
                  onChange={(e) => setDoForm({ ...doForm, customerName: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Shipping Address</label>
                <input
                  type="text"
                  value={doForm.shippingAddress}
                  onChange={(e) => setDoForm({ ...doForm, shippingAddress: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Delivery Lines */}
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Item to Pick *</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={doForm.lines[0]?.productId}
                    onChange={(e) => {
                      const updated = [...doForm.lines];
                      updated[0].productId = e.target.value;
                      setDoForm({ ...doForm, lines: updated });
                    }}
                    className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Quantity"
                    value={doForm.lines[0]?.orderedQty}
                    onChange={(e) => {
                      const updated = [...doForm.lines];
                      updated[0].orderedQty = Number(e.target.value);
                      setDoForm({ ...doForm, lines: updated });
                    }}
                    className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsDoModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Create Delivery Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Return */}
      {isReturnModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsReturnModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">Process Inventory Return</h3>
                <p className="text-xs text-stone-500">Record customer swap / refund or supplier RMA return</p>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Returns Presets */}
            <div className="mt-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Return Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyReturnPreset('customer')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  📦 Customer Return (Swap/Refund)
                </button>
                <button
                  type="button"
                  onClick={() => applyReturnPreset('supplier')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🔄 Supplier RMA (Quality Fail)
                </button>
              </div>
            </div>

            <form onSubmit={handleProcessReturn} className="space-y-3 pt-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Return Direction</label>
                <select
                  value={returnForm.returnType}
                  onChange={(e) => setReturnForm({ ...returnForm, returnType: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-semibold"
                >
                  <option value="CUSTOMER_RETURN">Customer Return (Stock Increments +)</option>
                  <option value="SUPPLIER_RETURN">Supplier RMA Return (Stock Decrements -)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Product</label>
                <select
                  value={returnForm.productId}
                  onChange={(e) => setReturnForm({ ...returnForm, productId: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Reference Doc</label>
                  <input
                    type="text"
                    value={returnForm.referenceDoc}
                    onChange={(e) => setReturnForm({ ...returnForm, referenceDoc: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Execute Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Two-Way Document Comment Thread Modal for Manager */}
      {activeDocComment && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveDocComment(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 uppercase">
                    {activeDocComment.type} Discussion: {activeDocComment.id}
                  </h3>
                  <p className="text-[11px] text-stone-500">Live notes between inventory management and warehouse floor staff</p>
                </div>
              </div>
              <button
                onClick={() => setActiveDocComment(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DocumentCommentThread
              documentType={activeDocComment.type}
              documentId={activeDocComment.id}
              warehouseId={activeDocComment.warehouseId}
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveDocComment(null)}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
