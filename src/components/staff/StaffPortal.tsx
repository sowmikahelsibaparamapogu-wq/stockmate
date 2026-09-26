import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  SlidersHorizontal,
  ScanBarcode,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
  X,
  Sparkles,
  Camera,
  Flashlight,
  SwitchCamera,
  RefreshCw,
  Scan,
  Box,
  Layers,
  Search,
  Building2,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { StatusBadge } from '../common/StatusBadge.tsx';
import {
  BarcodeScannerModal,
  playSuccessBeep,
  playErrorTone,
} from '../common/BarcodeScannerModal.tsx';
import { BarcodeScannerTerminal } from '../common/BarcodeScannerTerminal.tsx';
import { DocumentCommentThread } from '../common/DocumentCommentThread.tsx';

interface StaffPortalProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
}

export interface ActiveScanContext {
  target: 'receipt_line' | 'delivery_line' | 'transfer' | 'stock_count' | 'global';
  lineId?: number;
  expectedProductId?: number;
  expectedProductName?: string;
  expectedSku?: string;
  expectedLocationId?: number;
  expectedLocationCode?: string;
  expectedQty?: number;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({ currentTab, onNavigateTab }) => {
  const { token, dbUser } = useAuth();
  const { showToast } = useToast();

  const [receipts, setReceipts] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Two-way Document Notes & Discussion modal for Staff
  const [staffDocComment, setStaffDocComment] = useState<{
    type: 'receipt' | 'delivery' | 'transfer' | 'adjustment';
    id: string;
    warehouseId?: number;
  } | null>(null);

  // Scanner modal & contextual validation state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeScanContext, setActiveScanContext] = useState<ActiveScanContext | null>(null);
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  // Mismatch confirmation state
  const [mismatchData, setMismatchData] = useState<{
    scannedProduct: any;
    context: ActiveScanContext;
  } | null>(null);

  // Receipt Execution State
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [receiptLineInputs, setReceiptLineInputs] = useState<
    Record<number, { receivedQty: number; locationId: number; batchNo: string; expiryDate: string }>
  >({});

  // Delivery Pick State
  const [activeDelivery, setActiveDelivery] = useState<any | null>(null);
  const [deliveryPickState, setDeliveryPickState] = useState<Record<number, { pickedQty: number; flagged: boolean }>>({});

  // Transfer State
  const [transferForm, setTransferForm] = useState({
    warehouseId: '',
    fromLocationId: '',
    toLocationId: '',
    productId: '',
    quantity: 1,
    notes: '',
  });

  // Physical Stock Count State
  const [countForm, setCountForm] = useState({
    warehouseId: '',
    locationId: '',
    productId: '',
    countedQty: 0,
    reason: 'Cycle Count Audit',
    staffComment: '',
  });
  const [countProductSearch, setCountProductSearch] = useState('');
  const [transferProductSearch, setTransferProductSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, dRes, tRes, pRes, wRes] = await Promise.all([
        fetch('/api/v1/receipts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/delivery-orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/transfers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (rRes.ok) setReceipts(await rRes.json());
      if (dRes.ok) setDeliveries(await dRes.json());
      if (tRes.ok) setTransfers(await tRes.json());
      if (pRes.ok) setProducts(await pRes.json());
      if (wRes.ok) setWarehouses(await wRes.json());
    } catch (e: any) {
      showToast(e.message || 'Error loading staff tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Open Receipt for processing
  const handleOpenReceipt = (rec: any) => {
    setActiveReceipt(rec);
    const initialInputs: Record<number, any> = {};
    for (const line of rec.lines || []) {
      initialInputs[line.id] = {
        receivedQty: line.receivedQty > 0 ? line.receivedQty : line.expectedQty,
        locationId: line.locationId,
        batchNo: line.batchNo || (line.product?.trackBatchExpiry ? `LOT-${Date.now().toString().slice(-4)}` : ''),
        expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : '',
      };
    }
    setReceiptLineInputs(initialInputs);
  };

  const handleValidateReceipt = async () => {
    if (!activeReceipt) return;
    try {
      const lineUpdates = Object.entries(receiptLineInputs).map(([id, val]) => ({
        id: Number(id),
        ...val,
      }));

      const res = await fetch(`/api/v1/receipts/${activeReceipt.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lineUpdates }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to validate receipt');
      }

      showToast(`Receipt ${activeReceipt.receiptNumber} confirmed! Stock updated into database.`);
      setActiveReceipt(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Open Delivery for pick & pack
  const handleOpenDelivery = (del: any) => {
    setActiveDelivery(del);
    const initialPick: Record<number, any> = {};
    for (const line of del.lines || []) {
      initialPick[line.id] = {
        pickedQty: line.pickedQty > 0 ? line.pickedQty : line.orderedQty,
        flagged: line.isOutOfStockFlagged || false,
      };
    }
    setDeliveryPickState(initialPick);
  };

  const handleFlagOutOfStockInPick = async (lineId: number) => {
    if (!activeDelivery) return;
    try {
      const res = await fetch(`/api/v1/delivery-orders/${activeDelivery.id}/pick-line`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lineId,
          flagOutOfStock: true,
        }),
      });

      if (res.ok) {
        setDeliveryPickState((prev) => ({
          ...prev,
          [lineId]: { ...prev[lineId], flagged: true },
        }));
        showToast('Out-of-stock flagged! Manager has been notified automatically to place an emergency reorder.');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleValidateDelivery = async () => {
    if (!activeDelivery) return;
    try {
      const res = await fetch(`/api/v1/delivery-orders/${activeDelivery.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch order');
      }

      showToast(`Delivery ${activeDelivery.doNumber} verified and dispatched!`);
      setActiveDelivery(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Submit Internal Transfer
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!transferForm.warehouseId || !transferForm.fromLocationId || !transferForm.toLocationId || !transferForm.productId) {
        showToast('Please select a facility, source rack, target rack, and product.', 'error');
        return;
      }
      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId: Number(transferForm.warehouseId),
          fromLocationId: Number(transferForm.fromLocationId),
          toLocationId: Number(transferForm.toLocationId),
          productId: Number(transferForm.productId),
          quantity: Number(transferForm.quantity),
          notes: transferForm.notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to execute transfer');
      }

      const created = await res.json();
      // Auto-validate transfer in warehouse flow
      await fetch(`/api/v1/transfers/${created.id}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast(`Transfer ${created.transferNumber} completed. Stock moved to target rack.`);
      setTransferForm({
        warehouseId: '',
        fromLocationId: '',
        toLocationId: '',
        productId: '',
        quantity: 1,
        notes: '',
      });
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Dedicated handlers to select item and auto-fill associated facility & location
  const handleSelectItemForCount = (selectedProductId: string) => {
    if (!selectedProductId) {
      setCountForm((prev) => ({ ...prev, productId: '', countedQty: 0 }));
      return;
    }
    const prod = products.find((p) => String(p.id) === String(selectedProductId));
    if (!prod) return;

    let targetWhId = countForm.warehouseId;
    let targetLocId = countForm.locationId;

    // Check if product has specific stock location
    const stockLoc = prod.stockLevels?.find((sl: any) => sl.quantity > 0) || prod.stockLevels?.[0];
    if (stockLoc) {
      for (const w of warehouses) {
        const foundLoc = (w.locations || []).find((l: any) => l.id === stockLoc.locationId);
        if (foundLoc) {
          targetWhId = String(w.id);
          targetLocId = String(foundLoc.id);
          break;
        }
      }
    }

    // Fallback if warehouse is not set or location is not valid
    if (!targetWhId && warehouses.length > 0) {
      targetWhId = String(warehouses[0].id);
    }
    const currentWh = warehouses.find((w) => String(w.id) === targetWhId) || warehouses[0];
    if (currentWh && (!targetLocId || !currentWh.locations?.some((l: any) => String(l.id) === targetLocId))) {
      targetLocId = String(currentWh.locations?.[0]?.id || '');
    }

    const recordedStock = prod.totalStock ?? 0;

    setCountForm({
      warehouseId: targetWhId,
      locationId: targetLocId,
      productId: String(prod.id),
      countedQty: recordedStock,
      reason: countForm.reason || 'Cycle Count Audit',
      staffComment: countForm.staffComment || '',
    });
    showToast(`Selected "${prod.name}" (Recorded: ${recordedStock} ${prod.unitOfMeasure || 'units'})`, 'success');
  };

  const handleSelectItemForTransfer = (selectedProductId: string) => {
    if (!selectedProductId) {
      setTransferForm((prev) => ({ ...prev, productId: '' }));
      return;
    }
    const prod = products.find((p) => String(p.id) === String(selectedProductId));
    if (!prod) return;

    let targetWhId = transferForm.warehouseId || String(warehouses[0]?.id || '');
    let currentWh = warehouses.find((w) => String(w.id) === targetWhId) || warehouses[0];
    const locs = currentWh?.locations || [];
    let sourceLocId = transferForm.fromLocationId;
    let targetLocId = transferForm.toLocationId;

    const stockLoc = prod.stockLevels?.find((sl: any) => sl.quantity > 0) || prod.stockLevels?.[0];
    if (stockLoc) {
      for (const w of warehouses) {
        const foundLoc = (w.locations || []).find((l: any) => l.id === stockLoc.locationId);
        if (foundLoc) {
          targetWhId = String(w.id);
          currentWh = w;
          sourceLocId = String(foundLoc.id);
          const otherLoc = (w.locations || []).find((l: any) => l.id !== foundLoc.id);
          if (otherLoc) targetLocId = String(otherLoc.id);
          break;
        }
      }
    }

    if (!sourceLocId && locs.length > 0) sourceLocId = String(locs[0].id);
    if (!targetLocId && locs.length > 1) targetLocId = String(locs[1].id);
    else if (!targetLocId && locs.length > 0) targetLocId = String(locs[0].id);

    setTransferForm((prev) => ({
      ...prev,
      productId: String(prod.id),
      warehouseId: targetWhId,
      fromLocationId: sourceLocId,
      toLocationId: targetLocId,
      quantity: Math.min(Math.max(1, (prod.totalStock || 0) > 0 ? 5 : 1), prod.totalStock || 10),
    }));
    showToast(`Selected "${prod.name}" for relocation`, 'success');
  };

  // Submit Physical Count Adjustment
  const handleSubmitCount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!countForm.warehouseId || !countForm.locationId || !countForm.productId) {
        showToast('Please select a facility, bin location, and item to count.', 'error');
        return;
      }
      const prod = products.find((p) => String(p.id) === String(countForm.productId));
      const recordedQty = prod?.totalStock ?? 0;

      const res = await fetch('/api/v1/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseId: Number(countForm.warehouseId),
          locationId: Number(countForm.locationId),
          reason: countForm.reason,
          staffComment: countForm.staffComment,
          lines: [
            {
              productId: Number(countForm.productId),
              recordedQty,
              countedQty: Number(countForm.countedQty),
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit count');
      }

      showToast('Stock count recorded! Sent to Inventory Manager review queue for sign-off.');
      setCountForm({
        warehouseId: '',
        locationId: '',
        productId: '',
        countedQty: 0,
        reason: 'Cycle Count Audit',
        staffComment: '',
      });
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Scan handler with expected item validation
  const handleBarcodeScanned = (lookup: any) => {
    setScannedResult(lookup);
    const item = lookup?.entity || lookup?.data || lookup;
    const isProduct = lookup?.type === 'product' || Boolean(item?.sku);

    if (!activeScanContext || !activeScanContext.expectedProductId) {
      // Standalone / global lookup scanner: plain found/not found lookup
      playSuccessBeep();
      if (item?.name) {
        showToast(`Scanned: ${item.name}`, 'success');
      }
      return;
    }

    // Contextual scanner with expected item comparison
    const expectedId = Number(activeScanContext.expectedProductId);
    const isMatch = isProduct && Number(item?.id) === expectedId;

    if (isMatch) {
      // MATCH CONFIRMED:
      // 1. Green toast + Beep
      playSuccessBeep();
      showToast(`✅ Match confirmed: ${item.name} (${item.sku})`, 'success');

      // 2. Auto-fill the quantity / line input
      if (activeScanContext.target === 'receipt_line' && activeScanContext.lineId) {
        const lineId = activeScanContext.lineId;
        const currentInputs = receiptLineInputs[lineId] || {};
        setReceiptLineInputs({
          ...receiptLineInputs,
          [lineId]: {
            ...currentInputs,
            receivedQty: activeScanContext.expectedQty ?? currentInputs.receivedQty ?? 1,
          },
        });
      } else if (activeScanContext.target === 'delivery_line' && activeScanContext.lineId) {
        const lineId = activeScanContext.lineId;
        const currentPick = deliveryPickState[lineId] || {};
        setDeliveryPickState({
          ...deliveryPickState,
          [lineId]: {
            ...currentPick,
            pickedQty: activeScanContext.expectedQty ?? currentPick.pickedQty ?? 1,
            flagged: false,
          },
        });
      } else if (activeScanContext.target === 'transfer') {
        setTransferForm((prev) => ({
          ...prev,
          productId: String(item.id),
        }));
      } else if (activeScanContext.target === 'stock_count') {
        setCountForm((prev) => ({
          ...prev,
          productId: String(item.id),
        }));
      }

      setActiveScanContext(null);
    } else {
      // MISMATCH:
      // 1. Red toast + distinct low-pitch error tone (not success beep)
      playErrorTone();
      const scannedName = item?.name || 'Unknown item';
      const expectedName = activeScanContext.expectedProductName || `Item #${expectedId}`;
      showToast(`⚠️ Mismatch: scanned "${scannedName}", expected "${expectedName}"`, 'error');

      // 2. Do NOT auto-fill the line, require explicit staff confirmation
      setMismatchData({
        scannedProduct: item,
        context: activeScanContext,
      });
    }
  };

  const handleAcceptSubstitution = () => {
    if (!mismatchData) return;
    const { scannedProduct, context } = mismatchData;

    if (context.target === 'receipt_line' && context.lineId) {
      const lineId = context.lineId;
      const currentInputs = receiptLineInputs[lineId] || {};
      setReceiptLineInputs({
        ...receiptLineInputs,
        [lineId]: {
          ...currentInputs,
          receivedQty: context.expectedQty ?? currentInputs.receivedQty ?? 1,
        },
      });
    } else if (context.target === 'delivery_line' && context.lineId) {
      const lineId = context.lineId;
      const currentPick = deliveryPickState[lineId] || {};
      setDeliveryPickState({
        ...deliveryPickState,
        [lineId]: {
          ...currentPick,
          pickedQty: context.expectedQty ?? currentPick.pickedQty ?? 1,
        },
      });
    } else if (context.target === 'transfer') {
      setTransferForm((prev) => ({
        ...prev,
        productId: String(scannedProduct?.id || prev.productId),
      }));
    } else if (context.target === 'stock_count') {
      setCountForm((prev) => ({
        ...prev,
        productId: String(scannedProduct?.id || prev.productId),
      }));
    }

    showToast(`Substitution accepted for "${scannedProduct?.name || 'item'}". Line updated.`, 'success');
    setMismatchData(null);
    setActiveScanContext(null);
  };

  // Staff Auto-Order & Presets
  const [autoOrderingSku, setAutoOrderingSku] = useState<string | null>(null);

  const handleStaffAutoOrder = async (p: any) => {
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
        throw new Error(err.error || 'Failed to trigger replenishment order');
      }
      const data = await res.json();
      showToast(
        `⚡ Replenishment PO ${data.purchaseOrder.poNumber} (${data.suggestedQuantity} units) issued to vendor! Dock receipt scheduled.`,
        'success'
      );
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAutoOrderingSku(null);
    }
  };

  const applyTransferPreset = (type: 'dock-to-rack' | 'bin-swap') => {
    const wh = warehouses[0];
    if (!wh) return;
    const locs = wh.locations || [];
    const fromLoc = locs.find((l: any) => l.type === 'receiving') || locs[0];
    const toLoc = locs.find((l: any) => l.type === 'storage') || locs[1] || locs[0];
    const prod = products[0];

    if (type === 'dock-to-rack') {
      setTransferForm({
        warehouseId: String(wh.id),
        fromLocationId: fromLoc ? String(fromLoc.id) : '',
        toLocationId: toLoc ? String(toLoc.id) : '',
        productId: prod ? String(prod.id) : '',
        quantity: 15,
        notes: 'Relocate newly received inbound pallets from dock staging to high-bay storage.',
      });
      showToast('Loaded preset: "🔄 Inbound Dock to High-Bay Rack"');
    } else {
      setTransferForm({
        warehouseId: String(wh.id),
        fromLocationId: locs[0] ? String(locs[0].id) : '',
        toLocationId: locs[1] ? String(locs[1].id) : (locs[0] ? String(locs[0].id) : ''),
        productId: products[1] ? String(products[1].id) : (prod ? String(prod.id) : ''),
        quantity: 8,
        notes: 'Replenishing pick face bin from overflow mezzanine racking.',
      });
      showToast('Loaded preset: "🔁 Pick-Face Bin Replenishment"');
    }
  };

  const applyCountPreset = (type: 'routine' | 'damaged') => {
    const wh = warehouses[0];
    if (!wh) return;
    const loc = (wh.locations || [])[0];
    const prod = products[0];
    const recorded = prod?.totalStock || 10;

    if (type === 'routine') {
      setCountForm({
        warehouseId: String(wh.id),
        locationId: loc ? String(loc.id) : '',
        productId: prod ? String(prod.id) : '',
        countedQty: Math.max(0, recorded - 2),
        reason: 'Monthly Scheduled Cycle Count Audit',
        staffComment: 'Discovered slight discrepancy of 2 units on lower pallet row.',
      });
      showToast('Loaded preset: "📋 Scheduled Cycle Count Audit"');
    } else {
      setCountForm({
        warehouseId: String(wh.id),
        locationId: loc ? String(loc.id) : '',
        productId: prod ? String(prod.id) : '',
        countedQty: Math.max(0, recorded - 5),
        reason: 'Damaged Goods Quarantine',
        staffComment: 'Water leak damaged 5 cartons on bottom shelf during rainfall. Quarantined.',
      });
      showToast('Loaded preset: "⚠️ Damaged Inventory Quarantine"');
    }
  };

  const staffWhId = dbUser?.assignedWarehouseId;
  const assignedWh = warehouses.find((w) => w.id === staffWhId);

  // Scope tasks to the staff member's assigned warehouse (or show all if unassigned)
  const pendingReceipts = receipts.filter((r) => {
    if (r.status !== 'Ready') return false;
    return !staffWhId || r.warehouseId === staffWhId;
  });

  const pendingDeliveries = deliveries.filter((d) => {
    if (d.status !== 'Ready') return false;
    return !staffWhId || d.warehouseId === staffWhId;
  });

  const pendingTransfers = transfers.filter((t) => {
    if (t.status !== 'Ready') return false;
    return !staffWhId || t.warehouseId === staffWhId;
  });

  return (
    <div className="space-y-6">
      {/* Staff Action Header */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-md border border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-red-400 block mb-1">
              Active Shift: {dbUser?.name || 'Warehouse Specialist'}
            </span>
            <h1 className="text-2xl font-black tracking-tight">Warehouse Floor Terminal</h1>
            <p className="text-xs text-stone-400 mt-1">
              Assigned queue: {pendingReceipts.length} Inbound | {pendingDeliveries.length} Pick & Pack | {pendingTransfers.length} Move Tasks
            </p>
          </div>

          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-black transition shadow-lg shrink-0"
          >
            <ScanBarcode className="w-5 h-5" />
            Scan Item / Location Tag
          </button>
        </div>
      </div>

      {/* Scanned Card Flash (if any) */}
      {scannedResult && (() => {
        const item = scannedResult.entity || scannedResult.data || scannedResult;
        const isProduct = String(scannedResult.type).toLowerCase() === 'product';
        return (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-start justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Scanned {isProduct ? 'Product' : 'Location'} Lookup
              </span>
              <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">
                {item?.name} ({item?.sku || item?.code})
              </h4>
              {isProduct ? (
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  Total Live Stock: <span className="font-bold">{item?.totalStock ?? 0} units</span> • Reorder Threshold: {item?.reorderThreshold ?? 10}
                </p>
              ) : (
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                  Facility Zone: {item?.zone || 'Storage'} • Facility: {item?.warehouse?.name || 'Central Warehouse'}
                </p>
              )}
            </div>
            <button
              onClick={() => setScannedResult(null)}
              className="p-1 text-stone-400 hover:text-stone-700 text-xs font-bold"
            >
              ✕ Dismiss
            </button>
          </div>
        );
      })()}

      {/* TAB 1: My Tasks (Unified Queue) */}
      {currentTab === 'staff_tasks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => onNavigateTab('staff_receipts')}
              className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer hover:border-red-300 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500">Inbound Receipts</span>
                <ArrowDownToLine className="w-4 h-4 text-sky-600" />
              </div>
              <span className="text-3xl font-extrabold text-stone-900 dark:text-stone-100">
                {pendingReceipts.length}
              </span>
              <p className="text-[11px] text-stone-400 mt-1">Goods waiting on dock to inspect & store</p>
            </div>

            <div
              onClick={() => onNavigateTab('staff_deliveries')}
              className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer hover:border-red-300 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500">Outbound Pick & Pack</span>
                <ArrowUpFromLine className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-3xl font-extrabold text-stone-900 dark:text-stone-100">
                {pendingDeliveries.length}
              </span>
              <p className="text-[11px] text-stone-400 mt-1">Delivery orders to pick from racks</p>
            </div>

            <div
              onClick={() => onNavigateTab('staff_stock_count')}
              className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer hover:border-red-300 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500">Cycle Count & Audit</span>
                <SlidersHorizontal className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-3xl font-extrabold text-stone-900 dark:text-stone-100">Audit</span>
              <p className="text-[11px] text-stone-400 mt-1">Verify physical shelf stock against system</p>
            </div>
          </div>

          {/* Urgent Tasks Checklist */}
          <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
            <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-red-600" />
              Priority Task Queue Scoped to Warehouse
            </h3>

            <div className="space-y-3">
              {pendingReceipts.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold">
                      INBOUND RECEIPT
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 mt-1">{r.receiptNumber}</h4>
                    <p className="text-xs text-stone-500">
                      From PO: {r.sourceDocument} • {r.lines?.length || 0} line items
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setStaffDocComment({
                          type: 'receipt',
                          id: r.receiptNumber,
                          warehouseId: r.warehouseId,
                        })
                      }
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-600 dark:text-stone-300 text-xs font-semibold flex items-center gap-1"
                      title="Document notes"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Notes</span>
                    </button>
                    <button
                      onClick={() => {
                        onNavigateTab('staff_receipts');
                        handleOpenReceipt(r);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Receive Stock
                    </button>
                  </div>
                </div>
              ))}

              {pendingDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      OUTBOUND PICK
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 mt-1">{d.doNumber}</h4>
                    <p className="text-xs text-stone-500">Customer: {d.customerName} • {d.lines?.length || 0} line items</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setStaffDocComment({
                          type: 'delivery',
                          id: d.doNumber,
                          warehouseId: d.warehouseId,
                        })
                      }
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-600 dark:text-stone-300 text-xs font-semibold flex items-center gap-1"
                      title="Document notes"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Notes</span>
                    </button>
                    <button
                      onClick={() => {
                        onNavigateTab('staff_deliveries');
                        handleOpenDelivery(d);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Pick & Pack
                    </button>
                  </div>
                </div>
              ))}

              {pendingTransfers.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                      INTERNAL TRANSFER
                    </span>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 mt-1">{t.transferNumber}</h4>
                    <p className="text-xs text-stone-500">
                      From: {t.fromLocation?.name || 'Bin'} → To: {t.toLocation?.name || 'Bin'} • {t.lines?.length || 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setStaffDocComment({
                          type: 'transfer',
                          id: t.transferNumber,
                          warehouseId: t.warehouseId,
                        })
                      }
                      className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-600 dark:text-stone-300 text-xs font-semibold flex items-center gap-1"
                      title="Document notes"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Notes</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab('staff_transfers')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Execute Move
                    </button>
                  </div>
                </div>
              ))}

              {pendingReceipts.length === 0 && pendingDeliveries.length === 0 && pendingTransfers.length === 0 && (
                <div className="text-center py-10 text-stone-400 text-xs">
                  All current tasks for {assignedWh ? assignedWh.name : 'this warehouse'} are completed! Use Barcode Scan or Stock Count to inspect shelves.
                </div>
              )}
            </div>
          </div>

          {/* Out-of-Stock Shelf Replenishment Priority Alerts */}
          <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Critical Out-of-Stock Shelf Replenishment Alerts
                </h3>
              </div>
              <span className="text-[11px] font-bold text-red-600">Immediate Vendor Replenish</span>
            </div>

            {products.filter((p) => (p.totalStock || 0) <= (p.reorderThreshold || 10)).length === 0 ? (
              <p className="text-xs text-stone-500 italic py-2">
                No items are currently depleted in this facility.
              </p>
            ) : (
              <div className="space-y-2">
                {products
                  .filter((p) => (p.totalStock || 0) <= (p.reorderThreshold || 10))
                  .slice(0, 4)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100">{p.name}</h4>
                        <p className="text-[11px] text-stone-500 font-mono">
                          SKU: {p.sku} • Live Stock: <span className="font-bold text-red-600">{p.totalStock || 0}</span> / Min: {p.reorderThreshold} {p.unitOfMeasure}
                        </p>
                      </div>
                      <button
                        onClick={() => handleStaffAutoOrder(p)}
                        disabled={autoOrderingSku === p.sku}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {autoOrderingSku === p.sku ? 'Ordering...' : '⚡ Auto-Replenish'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Receipts (Staff Execution Only) */}
      {currentTab === 'staff_receipts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Inbound Receiving Tasks
            </h2>
            <span className="text-xs text-stone-500">Inspect carton quantities, capture lot numbers & confirm</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {receipts.map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 font-mono">
                      {rec.receiptNumber}
                    </h3>
                    <StatusBadge status={rec.status} />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Facility: {rec.warehouse?.name} • PO Ref: {rec.sourceDocument}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {rec.lines?.map((l: any) => (
                      <span
                        key={l.id}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                      >
                        {l.product?.name}: <span className="font-bold">{l.receivedQty} / {l.expectedQty} units</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setStaffDocComment({
                        type: 'receipt',
                        id: rec.receiptNumber,
                        warehouseId: rec.warehouseId,
                      })
                    }
                    className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition flex items-center gap-1.5 text-xs font-semibold"
                    title="View / add notes"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Notes</span>
                  </button>

                  {rec.status !== 'Done' ? (
                    <button
                      onClick={() => handleOpenReceipt(rec)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Process Inbound Stock
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 px-2">
                      <CheckCircle2 className="w-4 h-4" /> Received & Shelved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Delivery Orders (Checklist Style Pick & Pack) */}
      {currentTab === 'staff_deliveries' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Delivery Orders (Pick & Pack)
            </h2>
            <span className="text-xs text-stone-500">Pick items from designated bins & pack for dispatch</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {deliveries.map((del) => (
              <div
                key={del.id}
                className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 font-mono">
                      {del.doNumber}
                    </h3>
                    <StatusBadge status={del.status} />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">Customer: {del.customerName} ({del.shippingAddress})</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {del.lines?.map((l: any) => (
                      <span
                        key={l.id}
                        className={`text-[11px] px-2.5 py-1 rounded-md border ${
                          l.isOutOfStockFlagged
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {l.product?.name}: <span className="font-bold">{l.pickedQty} / {l.orderedQty}</span>
                        {l.isOutOfStockFlagged && ' (Flagged Unavailable)'}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setStaffDocComment({
                        type: 'delivery',
                        id: del.doNumber,
                        warehouseId: del.warehouseId,
                      })
                    }
                    className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition flex items-center gap-1.5 text-xs font-semibold"
                    title="View / add notes"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Notes</span>
                  </button>

                  {del.status !== 'Done' ? (
                    <button
                      onClick={() => handleOpenDelivery(del)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Open Picking Checklist
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 px-2">
                      <CheckCircle2 className="w-4 h-4" /> Picked & Dispatched
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Internal Transfers */}
      {currentTab === 'staff_transfers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Execute Internal Stock Relocation
            </h2>
            <span className="text-xs text-stone-500">Move products between racks or zones within the facility</span>
          </div>

          <div className="p-6 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs max-w-xl">
            {/* Transfer Presets */}
            <div className="mb-4 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Transfer Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTransferPreset('dock-to-rack')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🔄 Dock to High-Bay Storage
                </button>
                <button
                  type="button"
                  onClick={() => applyTransferPreset('bin-swap')}
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🔁 Pick-Face Bin Replenishment
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Warehouse Facility *</label>
                <select
                  required
                  value={transferForm.warehouseId}
                  onChange={(e) => {
                    const newWhId = e.target.value;
                    const wh = warehouses.find((w) => String(w.id) === newWhId);
                    const locs = wh?.locations || [];
                    setTransferForm({
                      ...transferForm,
                      warehouseId: newWhId,
                      fromLocationId: locs[0] ? String(locs[0].id) : '',
                      toLocationId: locs[1] ? String(locs[1].id) : (locs[0] ? String(locs[0].id) : ''),
                    });
                  }}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                >
                  <option value="">Select Facility</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">From Location *</label>
                  <select
                    required
                    value={transferForm.fromLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Source Rack</option>
                    {warehouses
                      .find((w) => String(w.id) === transferForm.warehouseId)
                      ?.locations?.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">To Location *</label>
                  <select
                    required
                    value={transferForm.toLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Target Rack</option>
                    {warehouses
                      .find((w) => String(w.id) === transferForm.warehouseId)
                      ?.locations?.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-stone-700 dark:text-stone-300">Product *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const selected = products.find((p) => String(p.id) === String(transferForm.productId));
                        setActiveScanContext({
                          target: 'transfer',
                          expectedProductId: selected ? selected.id : undefined,
                          expectedProductName: selected ? selected.name : undefined,
                          expectedSku: selected ? selected.sku : undefined,
                        });
                        setScannerOpen(true);
                      }}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      <Scan className="w-3 h-3" />
                      <span>Scan Barcode</span>
                    </button>
                  </div>
                  <select
                    required
                    value={transferForm.productId}
                    onChange={(e) => handleSelectItemForTransfer(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Select Product to Relocate</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - {p.totalStock} {p.unitOfMeasure}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-bold"
                  />
                </div>
              </div>

              {/* Quick Select Item Chips for Relocation */}
              <div className="p-2.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-1.5">
                <span className="text-[11px] font-semibold text-stone-500 block">
                  Quick Select Product for Relocation:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {products.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectItemForTransfer(String(p.id))}
                      className={`px-2 py-1 rounded text-xs transition border ${
                        String(transferForm.productId) === String(p.id)
                          ? 'bg-red-600 text-white font-bold border-red-600 shadow-xs'
                          : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-red-400 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {p.name.split(' ')[0]} ({p.totalStock} {p.unitOfMeasure})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Relocation Notes</label>
                <textarea
                  rows={2}
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="e.g. Staging for morning distribution wave"
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-sm"
              >
                Confirm Stock Relocation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: Stock Count / Cycle Audit */}
      {currentTab === 'staff_stock_count' && (() => {
        const selectedProd = products.find((p) => String(p.id) === String(countForm.productId));
        const recordedStock = selectedProd?.totalStock ?? 0;
        const variance = Number(countForm.countedQty) - recordedStock;

        const filteredShelfProducts = products.filter((p) => {
          if (!countProductSearch) return true;
          const q = countProductSearch.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode?.toLowerCase().includes(q)
          );
        });

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-red-600" />
                  Physical Inventory Count (Stock Audit)
                </h2>
                <p className="text-xs text-stone-500">
                  Select an item from the shelf or dropdown below, verify shelf quantities, and submit for instant ledger alignment.
                </p>
              </div>

              {/* Search input for shelf items */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filter warehouse items..."
                  value={countProductSearch}
                  onChange={(e) => setCountProductSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Quick Shelf Item Selection Bar */}
            <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-red-600" />
                  Tap Any Warehouse Item to Count ({filteredShelfProducts.length} items available)
                </span>
                <span className="text-[11px] text-stone-400 font-mono">1-Click Auto-Populates Form</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {filteredShelfProducts.map((p) => {
                  const isSelected = String(countForm.productId) === String(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectItemForCount(String(p.id))}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-400/40'
                          : 'bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-stone-900 dark:text-stone-100'}`}>
                          {p.name}
                        </p>
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-red-100' : 'text-stone-500'}`}>
                          {p.sku}
                        </p>
                      </div>
                      <div className="mt-2 pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                        <span className={`text-[10px] ${isSelected ? 'text-red-100' : 'text-stone-400'}`}>
                          Recorded:
                        </span>
                        <span className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-stone-900 dark:text-stone-100'}`}>
                          {p.totalStock} {p.unitOfMeasure}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs max-w-xl">
              {/* Stock Count Presets */}
              <div className="mb-4 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Stock Count Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyCountPreset('routine')}
                    className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                  >
                    📋 Routine Cycle Count Variance (-2 units)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCountPreset('damaged')}
                    className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                  >
                    ⚠️ Damaged Stock Quarantine (-5 units)
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitCount} className="space-y-4 text-xs">
                {/* Product Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-stone-700 dark:text-stone-300">
                      Select Item to Count *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const selected = products.find((p) => String(p.id) === String(countForm.productId));
                        setActiveScanContext({
                          target: 'stock_count',
                          expectedProductId: selected ? selected.id : undefined,
                          expectedProductName: selected ? selected.name : undefined,
                          expectedSku: selected ? selected.sku : undefined,
                        });
                        setScannerOpen(true);
                      }}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      <Scan className="w-3 h-3" />
                      <span>Scan Shelf Item</span>
                    </button>
                  </div>
                  <select
                    required
                    value={countForm.productId}
                    onChange={(e) => handleSelectItemForCount(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-semibold"
                  >
                    <option value="">-- Choose an Item from Warehouse --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) • Recorded Stock: {p.totalStock} {p.unitOfMeasure}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Item Telemetry Card */}
                {selectedProd && (
                  <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-stone-900 dark:text-stone-100 text-sm block">
                          {selectedProd.name}
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          SKU: {selectedProd.sku} • Barcode: {selectedProd.barcode || 'N/A'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">System Ledger</span>
                        <span className="text-sm font-bold font-mono text-stone-800 dark:text-stone-200">
                          {recordedStock} {selectedProd.unitOfMeasure}
                        </span>
                      </div>
                    </div>

                    {/* Stepper and Live Variance Meter */}
                    <div className="pt-2 border-t border-red-200/60 dark:border-red-900/40 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                          Counted Physical Units
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCountForm((prev) => ({
                                ...prev,
                                countedQty: Math.max(0, Number(prev.countedQty) - 1),
                              }))
                            }
                            className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 font-bold text-sm flex items-center justify-center transition"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            required
                            value={countForm.countedQty}
                            onChange={(e) =>
                              setCountForm({ ...countForm, countedQty: Number(e.target.value) })
                            }
                            className="w-20 text-center bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg py-1.5 font-mono font-black text-base text-stone-900 dark:text-stone-100"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCountForm((prev) => ({
                                ...prev,
                                countedQty: Number(prev.countedQty) + 1,
                              }))
                            }
                            className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-600 font-bold text-sm flex items-center justify-center transition"
                          >
                            +
                          </button>
                          <span className="text-xs text-stone-500 font-semibold">
                            {selectedProd.unitOfMeasure}
                          </span>
                        </div>
                      </div>

                      {/* Variance Indicator */}
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-stone-500 block mb-0.5">
                          Calculated Variance
                        </span>
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            variance === 0
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                              : variance < 0
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                              : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {variance === 0 ? (
                            <span>✓ Aligned (0)</span>
                          ) : (
                            <span>
                              {variance > 0 ? `+${variance}` : variance} {selectedProd.unitOfMeasure}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Facility *</label>
                    <select
                      required
                      value={countForm.warehouseId}
                      onChange={(e) => {
                        const newWhId = e.target.value;
                        const wh = warehouses.find((w) => String(w.id) === newWhId);
                        setCountForm({
                          ...countForm,
                          warehouseId: newWhId,
                          locationId: wh?.locations?.[0] ? String(wh.locations[0].id) : '',
                        });
                      }}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Bin Location *</label>
                    <select
                      required
                      value={countForm.locationId}
                      onChange={(e) => setCountForm({ ...countForm, locationId: e.target.value })}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                    >
                      <option value="">Select Bin</option>
                      {warehouses
                        .find((w) => String(w.id) === countForm.warehouseId)
                        ?.locations?.map((loc: any) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Count Reason</label>
                  <select
                    value={countForm.reason}
                    onChange={(e) => setCountForm({ ...countForm, reason: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="Cycle Count Audit">Cycle Count Audit</option>
                    <option value="Damaged Stock">Damaged Stock</option>
                    <option value="Loss / Theft">Loss / Theft</option>
                    <option value="Expired Goods">Expired Goods</option>
                    <option value="Annual Verification">Annual Verification</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Staff Note</label>
                  <textarea
                    rows={2}
                    value={countForm.staffComment}
                    onChange={(e) => setCountForm({ ...countForm, staffComment: e.target.value })}
                    placeholder="e.g. Discrepancy confirmed by physical verification"
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-sm"
                >
                  Submit Count for Manager Verification
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* TAB 6: Direct Barcode Scan View */}
      {currentTab === 'staff_scan' && (
        <BarcodeScannerTerminal standalone onDetected={handleBarcodeScanned} />
      )}

      {/* MODAL: Execute Receipt Processing */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                  Receive Inbound Goods: {activeReceipt.receiptNumber}
                </h3>
                <p className="text-xs text-stone-500">Verify delivered quantities and inspect packages</p>
              </div>
              <button onClick={() => setActiveReceipt(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {activeReceipt.lines?.map((line: any) => {
                const inputs = receiptLineInputs[line.id] || {
                  receivedQty: line.expectedQty,
                  batchNo: '',
                  expiryDate: '',
                };

                return (
                  <div
                    key={line.id}
                    className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{line.product?.name}</h4>
                        <p className="text-xs text-stone-500 font-mono">
                          {line.product?.sku} • Expected: {line.expectedQty} {line.product?.unitOfMeasure}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveScanContext({
                            target: 'receipt_line',
                            lineId: line.id,
                            expectedProductId: line.productId,
                            expectedProductName: line.product?.name,
                            expectedSku: line.product?.sku,
                            expectedQty: line.expectedQty,
                          });
                          setScannerOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>Scan Item</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Counted Received Qty *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={inputs.receivedQty}
                          onChange={(e) => {
                            setReceiptLineInputs({
                              ...receiptLineInputs,
                              [line.id]: { ...inputs, receivedQty: Number(e.target.value) },
                            });
                          }}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg p-2 font-bold text-stone-900 dark:text-stone-100 text-sm"
                        />
                      </div>

                      {line.product?.trackBatchExpiry && (
                        <>
                          <div>
                            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                              Batch / Lot # *
                            </label>
                            <input
                              type="text"
                              value={inputs.batchNo}
                              placeholder="e.g. BATCH-2026-01"
                              onChange={(e) => {
                                setReceiptLineInputs({
                                  ...receiptLineInputs,
                                  [line.id]: { ...inputs, batchNo: e.target.value },
                                });
                              }}
                              className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg p-2 text-stone-900 dark:text-stone-100 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                              Expiry Date
                            </label>
                            <input
                              type="date"
                              value={inputs.expiryDate}
                              onChange={(e) => {
                                setReceiptLineInputs({
                                  ...receiptLineInputs,
                                  [line.id]: { ...inputs, expiryDate: e.target.value },
                                });
                              }}
                              className="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg p-2 text-stone-900 dark:text-stone-100"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Document Notes & Communication Thread */}
            <div className="pt-2">
              <DocumentCommentThread
                documentType="receipt"
                documentId={activeReceipt.receiptNumber}
                warehouseId={activeReceipt.warehouseId}
                title={`Dock Communication: ${activeReceipt.receiptNumber}`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidateReceipt}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Validate & Shelve Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Execute Delivery Order Picking Checklist */}
      {activeDelivery && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                  Pick & Pack: {activeDelivery.doNumber}
                </h3>
                <p className="text-xs text-stone-500">Destination: {activeDelivery.customerName}</p>
              </div>
              <button onClick={() => setActiveDelivery(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {activeDelivery.lines?.map((line: any) => {
                const pick = deliveryPickState[line.id] || { pickedQty: line.orderedQty, flagged: false };

                return (
                  <div
                    key={line.id}
                    className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">{line.product?.name}</h4>
                        <p className="text-stone-500 font-mono mt-0.5">
                          Bin: <span className="font-bold text-red-600">{line.location?.name || 'Main Rack'}</span> • SKU: {line.product?.sku}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-stone-200 dark:bg-stone-700">
                          Target: {line.orderedQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveScanContext({
                              target: 'delivery_line',
                              lineId: line.id,
                              expectedProductId: line.productId,
                              expectedProductName: line.product?.name,
                              expectedSku: line.product?.sku,
                              expectedQty: line.orderedQty,
                              expectedLocationId: line.locationId,
                              expectedLocationCode: line.location?.name,
                            });
                            setScannerOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          <Scan className="w-3.5 h-3.5" />
                          <span>Scan Pick</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <label className="font-medium text-stone-600 dark:text-stone-400">Picked Qty:</label>
                        <input
                          type="number"
                          min="0"
                          max={line.orderedQty}
                          value={pick.pickedQty}
                          onChange={(e) => {
                            setDeliveryPickState({
                              ...deliveryPickState,
                              [line.id]: { ...pick, pickedQty: Number(e.target.value) },
                            });
                          }}
                          className="w-20 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded p-1 font-bold font-mono text-center text-stone-900 dark:text-stone-100"
                        />
                      </div>

                      {/* Escalation button to manager */}
                      <button
                        type="button"
                        onClick={() => handleFlagOutOfStockInPick(line.id)}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 ${
                          pick.flagged
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'border border-red-500 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {pick.flagged ? 'Flagged to Manager' : 'Flag Stock Missing'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Document Notes & Communication Thread */}
            <div className="pt-2">
              <DocumentCommentThread
                documentType="delivery"
                documentId={activeDelivery.doNumber}
                warehouseId={activeDelivery.warehouseId}
                title={`Floor Communication: ${activeDelivery.doNumber}`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setActiveDelivery(null)}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleValidateDelivery}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Validate Dispatch (Stock -)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Explicit Staff Confirmation on Barcode Item Mismatch */}
      {mismatchData && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                  Barcode Item Mismatch Detected
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  The scanned physical item does not match the item specified in this task line.
                </p>
              </div>
              <button
                onClick={() => {
                  setMismatchData(null);
                  setActiveScanContext(null);
                }}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <span className="font-bold text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                  Expected Item
                </span>
                <p className="font-bold text-stone-900 dark:text-stone-100">
                  {mismatchData.context.expectedProductName || `Item #${mismatchData.context.expectedProductId}`}
                </p>
                {mismatchData.context.expectedSku && (
                  <p className="font-mono text-[11px] text-stone-500">
                    SKU: {mismatchData.context.expectedSku}
                  </p>
                )}
                {mismatchData.context.expectedQty !== undefined && (
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">
                    Expected Qty: {mismatchData.context.expectedQty}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-1">
                <span className="font-bold text-[10px] text-red-700 dark:text-red-400 uppercase tracking-wider block">
                  Scanned Physical Item
                </span>
                <p className="font-bold text-stone-900 dark:text-stone-100">
                  {mismatchData.scannedProduct?.name || 'Unrecognized Item'}
                </p>
                <p className="font-mono text-[11px] text-stone-500">
                  SKU: {mismatchData.scannedProduct?.sku || 'N/A'}
                </p>
                {mismatchData.scannedProduct?.barcode && (
                  <p className="font-mono text-[11px] text-stone-500">
                    Barcode: {mismatchData.scannedProduct.barcode}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/60 p-3 rounded-lg">
              To prevent shipping or inventory errors, automatic line filling was paused. Do you want to explicitly accept this item as an approved substitution or exception?
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMismatchData(null);
                  setActiveScanContext(null);
                }}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Reject & Re-Scan
              </button>
              <button
                type="button"
                onClick={handleAcceptSubstitution}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Explicitly Accept Substitution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Standalone Document Discussion Thread for Staff */}
      {staffDocComment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 capitalize">
                    {staffDocComment.type} Discussion: {staffDocComment.id}
                  </h3>
                  <p className="text-[11px] text-stone-500">Live notes between floor staff and inventory managers</p>
                </div>
              </div>
              <button
                onClick={() => setStaffDocComment(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DocumentCommentThread
              documentType={staffDocComment.type}
              documentId={staffDocComment.id}
              warehouseId={staffDocComment.warehouseId}
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStaffDocComment(null)}
                className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal with Contextual Validation */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setActiveScanContext(null);
        }}
        onDetected={handleBarcodeScanned}
        expectedProductId={activeScanContext?.expectedProductId}
        expectedProductName={activeScanContext?.expectedProductName}
        expectedLocationId={activeScanContext?.expectedLocationId}
        expectedLocationCode={activeScanContext?.expectedLocationCode}
        title={
          activeScanContext?.expectedProductName
            ? `Scan & Verify: ${activeScanContext.expectedProductName}`
            : 'Scan Barcode or Location Tag'
        }
      />
    </div>
  );
};
