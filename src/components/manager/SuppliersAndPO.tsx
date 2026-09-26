import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  ShoppingBag,
  Sparkles,
  Calendar,
  Building,
  User,
  ArrowRight,
  X,
  CheckCircle,
  Search,
  Clock,
  FileText,
  CheckCircle2,
  Truck,
  Eye,
  History,
  ArrowDownToLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { StatusBadge } from '../common/StatusBadge.tsx';

interface SuppliersAndPOProps {
  initialPreFillSku?: string;
  onClearPreFill?: () => void;
}

export const SuppliersAndPO: React.FC<SuppliersAndPOProps> = ({
  initialPreFillSku,
  onClearPreFill,
}) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [pos, setPos] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & History State
  const [poFilter, setPoFilter] = useState<'all' | 'active' | 'history'>('all');
  const [poSearch, setPoSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState<any | null>(null);

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contactName: '',
    email: '',
    phone: '',
    leadTimeDays: 3,
    address: '',
  });

  // PO Form
  const [poForm, setPoForm] = useState<{
    supplierId: string;
    warehouseId: string;
    notes: string;
    lines: Array<{
      productId: string;
      quantityOrdered: number;
      unitPrice: string;
      autoSuggested: boolean;
      suggestedQty?: number;
      suggestionExplanation?: string;
    }>;
  }>({
    supplierId: '',
    warehouseId: '',
    notes: '',
    lines: [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [poRes, supRes, whRes, prodRes] = await Promise.all([
        fetch('/api/v1/purchase-orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/products', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (poRes.ok && supRes.ok && whRes.ok && prodRes.ok) {
        setPos(await poRes.json());
        setSuppliersList(await supRes.json());
        const whs = await whRes.json();
        setWarehousesList(whs);
        const prods = await prodRes.json();
        setProductsList(prods);
      }
    } catch (e: any) {
      showToast(e.message || 'Error loading purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Handle auto-prefill from Quick Reorder (from Dashboard / Products)
  useEffect(() => {
    if (initialPreFillSku && productsList.length > 0) {
      const match =
        productsList.find((p) => p.sku?.trim().toLowerCase() === initialPreFillSku?.trim().toLowerCase()) ||
        productsList.find((p) => String(p.id) === String(initialPreFillSku)) ||
        productsList[0];

      if (match) {
        openPoModalWithProduct(match);
      }
      if (onClearPreFill) onClearPreFill();
    }
  }, [initialPreFillSku, productsList]);

  // Helper to fetch live auto-suggestion from backend endpoint
  const fetchSuggestionForProduct = async (productId: number) => {
    try {
      const res = await fetch(`/api/v1/products/${productId}/reorder-suggestion`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to get reorder suggestion:', e);
    }
    return null;
  };

  const openPoModalWithProduct = async (prod: any) => {
    setIsPoModalOpen(true);
    const suggestion = await fetchSuggestionForProduct(prod.id);
    const suggestedQty = suggestion?.suggestedQuantity || prod.reorderThreshold || 20;

    setPoForm({
      supplierId: suppliersList[0]?.id?.toString() || '1',
      warehouseId: warehousesList[0]?.id?.toString() || '1',
      notes: `Restock order generated for ${prod.sku}`,
      lines: [
        {
          productId: String(prod.id),
          quantityOrdered: suggestedQty,
          unitPrice: prod.costPrice || '10.00',
          autoSuggested: true,
          suggestedQty,
          suggestionExplanation: suggestion?.explanation || 'Calculated from live reorder threshold & burn rate.',
        },
      ],
    });
  };

  // Preset Configurations for Quick Form Filling
  const applyPoPreset = async (presetType: 'urgent' | 'bulk' | 'sample') => {
    if (productsList.length === 0) return;
    const supId = suppliersList[0]?.id?.toString() || '1';
    const whId = warehousesList[0]?.id?.toString() || '1';

    if (presetType === 'urgent') {
      const outOrLow = productsList.filter((p) => p.totalStock <= p.reorderThreshold);
      const targetProds = outOrLow.length > 0 ? outOrLow.slice(0, 2) : productsList.slice(0, 2);
      const lines = await Promise.all(
        targetProds.map(async (p) => {
          const sug = await fetchSuggestionForProduct(p.id);
          const qty = sug?.suggestedQuantity || p.reorderThreshold || 20;
          return {
            productId: String(p.id),
            quantityOrdered: qty,
            unitPrice: p.costPrice || '12.00',
            autoSuggested: true,
            suggestedQty: qty,
            suggestionExplanation: sug?.explanation || 'Computed threshold replenishment',
          };
        })
      );
      setPoForm({
        supplierId: supId,
        warehouseId: whId,
        notes: '🚨 Urgent Replenishment: Restocking depleted stock items to safety target.',
        lines,
      });
      showToast('Loaded preset: "⚡ Urgent Depleted Restock"');
    } else if (presetType === 'bulk') {
      const targetProds = productsList.slice(0, 3);
      setPoForm({
        supplierId: supId,
        warehouseId: whId,
        notes: '📦 High-Volume Pallet Replenishment for high-density warehouse racking.',
        lines: targetProds.map((p) => ({
          productId: String(p.id),
          quantityOrdered: (p.reorderThreshold || 15) * 3,
          unitPrice: p.costPrice || '10.00',
          autoSuggested: false,
        })),
      });
      showToast('Loaded preset: "📦 Bulk High-Volume Restock"');
    } else {
      const targetProds = productsList.slice(0, 1);
      setPoForm({
        supplierId: supId,
        warehouseId: whId,
        notes: '🧪 Pilot sample batch for incoming quality inspection.',
        lines: targetProds.map((p) => ({
          productId: String(p.id),
          quantityOrdered: 5,
          unitPrice: p.costPrice || '15.00',
          autoSuggested: false,
        })),
      });
      showToast('Loaded preset: "🧪 Pilot Sample Batch"');
    }
  };

  const applySupplierPreset = (preset: {
    name: string;
    code: string;
    contactName: string;
    email: string;
    phone?: string;
    leadTimeDays: number;
    address?: string;
  }) => {
    setSupplierForm({
      phone: preset.phone || '+65 6789 0123',
      address: preset.address || 'Singapore Logistics Hub',
      ...preset,
      code: `${preset.code}-${Math.floor(100 + Math.random() * 900)}`,
    });
    showToast(`Loaded supplier preset: "${preset.name}"`);
  };

  const handleOpenBlankPo = () => {
    const firstProd = productsList[0];
    setPoForm({
      supplierId: suppliersList[0]?.id?.toString() || '',
      warehouseId: warehousesList[0]?.id?.toString() || '',
      notes: '',
      lines: firstProd
        ? [
            {
              productId: String(firstProd.id),
              quantityOrdered: firstProd.reorderThreshold || 10,
              unitPrice: firstProd.costPrice || '0.00',
              autoSuggested: false,
            },
          ]
        : [],
    });
    setIsPoModalOpen(true);
  };

  const handleProductChangeInLine = async (lineIdx: number, newProductId: string) => {
    const prod = productsList.find((p) => String(p.id) === newProductId);
    if (!prod) return;

    const suggestion = await fetchSuggestionForProduct(prod.id);
    const suggestedQty = suggestion?.suggestedQuantity || prod.reorderThreshold || 10;

    const updatedLines = [...poForm.lines];
    updatedLines[lineIdx] = {
      productId: newProductId,
      quantityOrdered: suggestedQty,
      unitPrice: prod.costPrice || '0.00',
      autoSuggested: true,
      suggestedQty,
      suggestionExplanation: suggestion?.explanation,
    };
    setPoForm({ ...poForm, lines: updatedLines });
  };

  const handleAddLine = () => {
    const defaultProd = productsList[0];
    if (!defaultProd) return;
    setPoForm({
      ...poForm,
      lines: [
        ...poForm.lines,
        {
          productId: String(defaultProd.id),
          quantityOrdered: defaultProd.reorderThreshold || 10,
          unitPrice: defaultProd.costPrice || '0.00',
          autoSuggested: false,
        },
      ],
    });
  };

  const handleRemoveLine = (idx: number) => {
    const lines = poForm.lines.filter((_, i) => i !== idx);
    setPoForm({ ...poForm, lines });
  };

  const handleSavePo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(poForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit Purchase Order');
      }

      showToast('Purchase Order submitted and linked Receipt generated for warehouse staff!');
      setIsPoModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(supplierForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save supplier');
      }

      showToast('Supplier registered');
      setIsSupplierModalOpen(false);
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
            Suppliers & Purchase Orders
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Automated reorder suggestion engine, supplier lead time tracking, and inbound procurement flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSupplierForm({
                name: '',
                code: `SUP-${Date.now().toString().slice(-4)}`,
                contactName: '',
                email: '',
                phone: '',
                leadTimeDays: 3,
                address: '',
              });
              setIsSupplierModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-semibold"
          >
            <Building className="w-3.5 h-3.5" />
            Add Supplier
          </button>

          <button
            onClick={handleOpenBlankPo}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* PO List */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
            Purchase Orders Registry ({pos.length})
          </h3>
          <span className="text-xs text-stone-400">Linked automatically to warehouse inbound receipts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4">Ordered Items</th>
                <th className="py-3 px-4">Order Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    Loading Purchase Orders...
                  </td>
                </tr>
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No purchase orders recorded. Click "Create Purchase Order" to begin.
                  </td>
                </tr>
              ) : (
                pos.map((po) => {
                  const totalVal = po.lines?.reduce(
                    (sum: number, l: any) => sum + Number(l.quantityOrdered) * parseFloat(l.unitPrice || '0'),
                    0
                  );

                  return (
                    <tr key={po.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                        {po.poNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-stone-800 dark:text-stone-200">
                          {po.supplier?.name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">{po.supplier?.code}</span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">{po.warehouse?.name || 'CDC-01'}</td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {po.lines?.map((line: any) => (
                            <div key={line.id} className="text-[11px]">
                              <span className="font-semibold text-stone-800 dark:text-stone-200">
                                {line.product?.name}
                              </span>
                              <span className="text-stone-400 ml-1">
                                ({line.quantityReceived}/{line.quantityOrdered} rec.)
                              </span>
                              {line.autoSuggested && (
                                <span className="ml-1 text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-950 px-1 py-0.2 rounded">
                                  Auto-Suggested
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 dark:text-stone-100">
                        ${totalVal?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="py-3.5 px-4 text-stone-400 font-mono text-[11px]">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Directory Quick Glance */}
      <div className="p-5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
          <Building className="w-4 h-4 text-red-600" />
          Active Suppliers & Lead Times
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {suppliersList.map((s) => (
            <div
              key={s.id}
              className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs text-stone-900 dark:text-stone-100">{s.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700">
                  {s.code}
                </span>
              </div>
              <p className="text-[11px] text-stone-500">Contact: {s.contactName} ({s.email})</p>
              <div className="mt-2 text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                Lead Time: <span className="text-red-600">{s.leadTimeDays} business days</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Create Purchase Order with Auto-Reorder Suggestion */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                    New Purchase Order
                  </h3>
                  <p className="text-xs text-stone-500">Auto-suggested quantities computed live from ledger & threshold</p>
                </div>
              </div>
              <button onClick={() => setIsPoModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PO Presets */}
            <div className="mt-3 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick PO Presets (1-Click Fill):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPoPreset('urgent')}
                  className="px-2.5 py-1.5 bg-white dark:bg-stone-900 hover:border-red-400 dark:hover:border-red-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  ⚡ Urgent Depleted Restock
                </button>
                <button
                  type="button"
                  onClick={() => applyPoPreset('bulk')}
                  className="px-2.5 py-1.5 bg-white dark:bg-stone-900 hover:border-red-400 dark:hover:border-red-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  📦 Bulk Routine Restock
                </button>
                <button
                  type="button"
                  onClick={() => applyPoPreset('sample')}
                  className="px-2.5 py-1.5 bg-white dark:bg-stone-900 hover:border-red-400 dark:hover:border-red-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  🧪 Sample Pilot Batch (5 units)
                </button>
              </div>
            </div>

            <form onSubmit={handleSavePo} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Supplier *</label>
                  <select
                    required
                    value={poForm.supplierId}
                    onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) - {s.leadTimeDays}d lead
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Receiving Warehouse *</label>
                  <select
                    required
                    value={poForm.warehouseId}
                    onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Lines with live computed Reorder Suggestions */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-800 dark:text-stone-200">
                    Order Lines ({poForm.lines.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                {poForm.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] text-stone-500 mb-0.5">Product</label>
                        <select
                          value={line.productId}
                          onChange={(e) => handleProductChangeInLine(idx, e.target.value)}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md p-1.5 text-stone-900 dark:text-stone-100"
                        >
                          {productsList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) - Cur: {p.totalStock} / Thresh: {p.reorderThreshold}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] text-stone-500 mb-0.5">Quantity</label>
                          {line.autoSuggested && (
                            <span className="text-[9px] font-bold text-red-600">Suggested</span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.quantityOrdered}
                          onChange={(e) => {
                            const updated = [...poForm.lines];
                            updated[idx].quantityOrdered = Number(e.target.value);
                            setPoForm({ ...poForm, lines: updated });
                          }}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md p-1.5 text-stone-900 dark:text-stone-100 font-bold"
                        />
                      </div>

                      <div className="w-24">
                        <label className="block text-[11px] text-stone-500 mb-0.5">Unit Price ($)</label>
                        <input
                          type="text"
                          value={line.unitPrice}
                          onChange={(e) => {
                            const updated = [...poForm.lines];
                            updated[idx].unitPrice = e.target.value;
                            setPoForm({ ...poForm, lines: updated });
                          }}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md p-1.5 text-stone-900 dark:text-stone-100 font-mono"
                        />
                      </div>

                      {poForm.lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-stone-400 hover:text-red-600 p-1 self-end"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {line.suggestionExplanation && (
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 bg-white/70 dark:bg-stone-800 p-1.5 rounded border border-stone-200 dark:border-stone-700">
                        <Sparkles className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>{line.suggestionExplanation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Procurement Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  placeholder="Optional delivery instructions or project reference..."
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">Add Supplier</h3>
                <p className="text-xs text-stone-500">Register verified vendor, contact & delivery lead time</p>
              </div>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Supplier Presets */}
            <div className="mt-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Vendor Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    applySupplierPreset({
                      name: 'Apex Global Electronics Ltd',
                      code: 'APX',
                      contactName: 'David Zhang (Key Account Mgr)',
                      email: 'orders@apex-electronics.io',
                      leadTimeDays: 4,
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🏢 Apex Global
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySupplierPreset({
                      name: 'Continental Fasteners & Industrial',
                      code: 'CNT',
                      contactName: 'Elena Rostova (Logistics Lead)',
                      email: 'supply@continental-ind.com',
                      leadTimeDays: 7,
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🚛 Continental Freight
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySupplierPreset({
                      name: 'BioPharma Medical Direct',
                      code: 'BPH',
                      contactName: 'Marcus Tan (QA Director)',
                      email: 'dispatch@biopharma-sg.com',
                      leadTimeDays: 2,
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🧬 BioPharma Care
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 pt-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={supplierForm.code}
                    onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Lead Time (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={supplierForm.leadTimeDays}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: Number(e.target.value) })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={supplierForm.contactName}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Email</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
