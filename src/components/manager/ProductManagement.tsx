import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Upload,
  Download,
  AlertCircle,
  Edit,
  Trash2,
  Calendar,
  Layers,
  ArrowRightLeft,
  X,
  Check,
  Sparkles,
  MapPin,
  DollarSign,
  Info,
  Eye,
  Building,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { StatusBadge } from '../common/StatusBadge.tsx';

interface ProductManagementProps {
  onQuickReorder: (sku: string) => void;
}

const PRODUCT_PRESETS = [
  {
    label: '⚡ IoT Sensor Hub',
    data: {
      name: 'Industrial IoT Temperature & Humidity Sensor',
      sku: 'IOT-SENS',
      categoryMatch: 'Electronics',
      unitOfMeasure: 'units',
      unitsPerBox: 1,
      costPrice: '14.50',
      sellingPrice: '29.99',
      reorderThreshold: 20,
      trackBatchExpiry: false,
      description: 'Wireless IP67 temperature sensor with Bluetooth 5.2 and telemetry logging.',
    },
  },
  {
    label: '🔩 Heavy M12 Hex Bolts',
    data: {
      name: 'M12 Zinc-Plated High-Tensile Hex Bolts (Box/100)',
      sku: 'BLT-HEX-M12',
      categoryMatch: 'Hardware',
      unitOfMeasure: 'boxes',
      unitsPerBox: 100,
      costPrice: '8.20',
      sellingPrice: '18.50',
      reorderThreshold: 35,
      trackBatchExpiry: false,
      description: 'Grade 8.8 industrial hex cap screws with anti-corrosion coating.',
    },
  },
  {
    label: '💊 Cold-Chain Insulin Vials',
    data: {
      name: 'Recombinant Human Insulin 100IU/ml Vial',
      sku: 'MED-INS-100IU',
      categoryMatch: 'Medical',
      unitOfMeasure: 'bottles',
      unitsPerBox: 10,
      costPrice: '42.00',
      sellingPrice: '85.00',
      reorderThreshold: 25,
      trackBatchExpiry: true,
      description: 'Regulated injectable suspension, requires temperature 2-8°C refrigerated tracking.',
    },
  },
  {
    label: '☕ Organic Cold-Brew Pack',
    data: {
      name: 'Artisan Nitro Cold-Brew Single-Origin (Pack of 24)',
      sku: 'BEV-CB-24PK',
      categoryMatch: 'Beverages',
      unitOfMeasure: 'packs',
      unitsPerBox: 24,
      costPrice: '18.00',
      sellingPrice: '38.00',
      reorderThreshold: 30,
      trackBatchExpiry: true,
      description: 'Fresh roasted canned nitro cold brew, 6-month shelf life batch tracked.',
    },
  },
];

export const ProductManagement: React.FC<ProductManagementProps> = ({ onQuickReorder }) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [productsList, setProductsList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unitOfMeasure: 'units',
    unitsPerBox: 1,
    costPrice: '0.00',
    sellingPrice: '0.00',
    reorderThreshold: 10,
    trackBatchExpiry: false,
    description: '',
    initialStock: 0,
    warehouseId: '',
    locationId: '',
  });

  // Presets and Auto-Order state
  const [autoOrderingSku, setAutoOrderingSku] = useState<string | null>(null);

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
        throw new Error(err.error || 'Failed to auto-order');
      }
      const data = await res.json();
      showToast(
        `⚡ Auto-Order Successful: ${data.purchaseOrder.poNumber} (${data.suggestedQuantity} ${p.unitOfMeasure}) created!`,
        'success'
      );
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAutoOrderingSku(null);
    }
  };

  const applyProductPreset = (preset: typeof PRODUCT_PRESETS[0]) => {
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase().includes(preset.data.categoryMatch.toLowerCase())
    ) || categories[0];

    const randomSkuSuffix = Math.floor(100 + Math.random() * 900);
    const randomBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;

    setFormData((prev) => ({
      ...prev,
      ...preset.data,
      sku: `${preset.data.sku}-${randomSkuSuffix}`,
      barcode: randomBarcode,
      categoryId: matchedCategory ? String(matchedCategory.id) : '',
    }));
    showToast(`Loaded preset "${preset.label}"`);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, whRes] = await Promise.all([
        fetch('/api/v1/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (prodRes.ok && catRes.ok) {
        setProductsList(await prodRes.json());
        setCategories(await catRes.json());
      }
      if (whRes.ok) {
        setWarehouses(await whRes.json());
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    const defaultWh = warehouses[0];
    setFormData({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      categoryId: categories[0]?.id?.toString() || '',
      unitOfMeasure: 'units',
      unitsPerBox: 1,
      costPrice: '10.00',
      sellingPrice: '19.99',
      reorderThreshold: 15,
      trackBatchExpiry: false,
      description: '',
      initialStock: 25,
      warehouseId: defaultWh ? String(defaultWh.id) : '',
      locationId: defaultWh?.locations?.[0] ? String(defaultWh.locations[0].id) : '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId ? String(p.categoryId) : '',
      unitOfMeasure: p.unitOfMeasure,
      unitsPerBox: p.unitsPerBox,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      reorderThreshold: p.reorderThreshold,
      trackBatchExpiry: p.trackBatchExpiry,
      description: p.description || '',
      initialStock: 0,
      warehouseId: '',
      locationId: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `/api/v1/products/${editingProduct.id}` : '/api/v1/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save product');
      }

      showToast(editingProduct ? 'Product updated successfully' : 'Product created successfully');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product? All stock balances will be cleared.')) return;
    try {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Product deleted');
        fetchData();
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'SKU', 'Barcode', 'Category', 'UOM', 'Units/Box', 'Cost', 'Sell', 'Threshold', 'Stock'];
    const rows = productsList.map((p) => [
      p.id,
      `"${p.name}"`,
      p.sku,
      p.barcode,
      `"${p.category?.name || ''}"`,
      p.unitOfMeasure,
      p.unitsPerBox,
      p.costPrice,
      p.sellingPrice,
      p.reorderThreshold,
      p.totalStock,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stocksense_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = productsList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || String(p.categoryId) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Product Master & Catalog
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Full inventory registry, units of measure, SKU barcodes, and live stock positions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-stone-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">UOM & Box Conv.</th>
                <th className="py-3 px-4">Pricing</th>
                <th className="py-3 px-4">Live Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    Loading live product records...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    No products matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.totalStock === 0;
                  const isLow = p.totalStock > 0 && p.totalStock <= p.reorderThreshold;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`cursor-pointer transition ${
                        selectedProduct?.id === p.id
                          ? 'bg-red-50/80 dark:bg-red-950/40 ring-1 ring-red-400'
                          : 'hover:bg-stone-50/80 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                        {p.name}
                        {p.trackBatchExpiry && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                            <Calendar className="w-2.5 h-2.5" /> Batch & Expiry
                          </span>
                        )}
                        <p className="text-[11px] font-normal text-stone-400 truncate max-w-xs">{p.description}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="block text-stone-800 dark:text-stone-200">{p.sku}</span>
                        <span className="text-[10px] text-stone-400">{p.barcode}</span>
                      </td>
                      <td className="py-3.5 px-4">{p.category?.name || 'Unassigned'}</td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-medium">{p.unitOfMeasure}</span>
                        {p.unitsPerBox > 1 && (
                          <span className="block text-[10px] text-stone-500">
                            1 Box = {p.unitsPerBox} {p.unitOfMeasure}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div>Cost: ${p.costPrice}</div>
                        <div className="text-stone-400 text-[11px]">Sell: ${p.sellingPrice}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isOut
                              ? 'text-red-600 dark:text-red-400'
                              : isLow
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-stone-900 dark:text-stone-100'
                          }`}
                        >
                          {p.totalStock} {p.unitOfMeasure}
                        </span>
                        <span className="block text-[10px] text-stone-400">Min. Thresh: {p.reorderThreshold}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={
                            isOut ? 'Canceled' : isLow ? 'Waiting' : 'Done'
                          }
                        />
                        {Boolean(p.pendingInboundQty > 0) && (
                          <span className="block mt-1 font-mono text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                            +{p.pendingInboundQty} on {p.openOrder?.poNumber || 'order'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(p)}
                          title="Select & Inspect Item Details"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-500" />
                          <span>Inspect</span>
                        </button>
                        {p.pendingInboundQty > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] font-bold">
                            <span>En Route ({p.openOrder?.poNumber})</span>
                          </span>
                        ) : (isOut || isLow) ? (
                          <>
                            <button
                              onClick={() => handleInstantAutoOrder(p)}
                              disabled={autoOrderingSku === p.sku}
                              title="1-Click Automatic Purchase Order"
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"
                            >
                              <Sparkles className="w-3 h-3" />
                              {autoOrderingSku === p.sku ? 'Ordering...' : '⚡ Auto-Order'}
                            </button>
                            <button
                              onClick={() => onQuickReorder(p.sku)}
                              title="Auto-Suggest Reorder PO"
                              className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-400 rounded text-[11px] font-bold"
                            >
                              Reorder
                            </button>
                          </>
                        ) : null}
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 rounded text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">
                  {editingProduct ? 'Edit Inventory Item' : 'New Master Product'}
                </h3>
                <p className="text-xs text-stone-500">
                  {editingProduct ? 'Update specifications & threshold' : 'Register SKU, barcode & unit metrics'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Fill Presets Selector */}
            {!editingProduct && (
              <div className="mt-4 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Field Presets (1-Click Fill):
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_PRESETS.map((pr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyProductPreset(pr)}
                      className="px-2.5 py-1.5 bg-white dark:bg-stone-900 hover:border-red-400 dark:hover:border-red-700 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1"
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-stone-700 dark:text-stone-300">SKU / Code *</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}` })}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold"
                    >
                      ⚡ Auto SKU
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-stone-700 dark:text-stone-300">Barcode Value *</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}` })}
                      className="text-[10px] text-red-600 hover:text-red-700 font-semibold"
                    >
                      ⚡ Auto Barcode
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                {/* Initial Stock & Storage Placement for New Products */}
                {!editingProduct && (
                  <div className="sm:col-span-2 p-3.5 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/60 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                      <Building className="w-3.5 h-3.5" />
                      <span>Initial Opening Stock & Warehouse Location (Optional)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Opening Stock Units
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.initialStock}
                          onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                          placeholder="0 units"
                          className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2 text-stone-900 dark:text-stone-100 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Storage Warehouse
                        </label>
                        <select
                          value={formData.warehouseId}
                          onChange={(e) => {
                            const whId = e.target.value;
                            const wh = warehouses.find((w) => String(w.id) === whId);
                            setFormData({
                              ...formData,
                              warehouseId: whId,
                              locationId: wh?.locations?.[0] ? String(wh.locations[0].id) : '',
                            });
                          }}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2 text-stone-900 dark:text-stone-100"
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
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Assigned Rack / Bin
                        </label>
                        <select
                          value={formData.locationId}
                          onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                          className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2 text-stone-900 dark:text-stone-100"
                        >
                          <option value="">Select Bin Location</option>
                          {warehouses
                            .find((w) => String(w.id) === formData.warehouseId)
                            ?.locations?.map((loc: any) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name} ({loc.code})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Unit of Measure</label>
                  <select
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  >
                    <option value="units">Units</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                    <option value="bottles">Bottles</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="liters">Liters</option>
                    <option value="pallets">Pallets</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Units per Box / Carton</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.unitsPerBox}
                    onChange={(e) => setFormData({ ...formData, unitsPerBox: Number(e.target.value) })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Reorder Threshold *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.reorderThreshold}
                    onChange={(e) => setFormData({ ...formData, reorderThreshold: Number(e.target.value) })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Cost Price ($)</label>
                  <input
                    type="text"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Selling Price ($)</label>
                  <input
                    type="text"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700">
                  <input
                    type="checkbox"
                    id="trackExpiry"
                    checked={formData.trackBatchExpiry}
                    onChange={(e) => setFormData({ ...formData, trackBatchExpiry: e.target.checked })}
                    className="rounded border-stone-300 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <label htmlFor="trackExpiry" className="text-stone-800 dark:text-stone-200 font-medium">
                    Enable Batch/Lot & Expiry Tracking (Recommended for perishable / cold-chain goods)
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Selected Item Telemetry & Inspection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-red-600/10 text-red-600 dark:text-red-400">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                      Selected Item Inspector
                    </span>
                    <span className="text-xs font-mono text-stone-400">ID #{selectedProduct.id}</span>
                  </div>
                  <h3 className="font-bold text-xl text-stone-900 dark:text-stone-100 mt-1">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono">
                    SKU: <strong className="text-stone-800 dark:text-stone-200">{selectedProduct.sku}</strong> • Barcode: {selectedProduct.barcode || 'N/A'} • Category: {selectedProduct.category?.name || 'Unassigned'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inventory Balance & Financial Valuation Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Current Balance</span>
                <span className="text-xl font-black text-stone-900 dark:text-stone-100">
                  {selectedProduct.totalStock} {selectedProduct.unitOfMeasure}
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  Min: {selectedProduct.reorderThreshold} {selectedProduct.unitOfMeasure}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Cost & Selling</span>
                <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                  ${selectedProduct.sellingPrice}
                </span>
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  Cost: ${selectedProduct.costPrice}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Gross Margin</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {(() => {
                    const sell = parseFloat(selectedProduct.sellingPrice || '0');
                    const cost = parseFloat(selectedProduct.costPrice || '0');
                    if (sell <= 0) return '0.0%';
                    return `${(((sell - cost) / sell) * 100).toFixed(1)}%`;
                  })()}
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  Markup: ${(Math.max(0, parseFloat(selectedProduct.sellingPrice || '0') - parseFloat(selectedProduct.costPrice || '0'))).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Inventory Valuation</span>
                <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                  ${(Number(selectedProduct.totalStock || 0) * parseFloat(selectedProduct.costPrice || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">At FIFO Cost Basis</span>
              </div>
            </div>

            {/* Storage Racks & Bin Locations */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-600" />
                Warehouse & Bin Location Breakdown
              </span>
              {selectedProduct.stockLevels && selectedProduct.stockLevels.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedProduct.stockLevels.map((lvl: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          {lvl.location?.name || `Bin #${lvl.locationId}`}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {lvl.location?.code} ({lvl.location?.zone || 'Storage'})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        {lvl.quantity} {selectedProduct.unitOfMeasure}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic p-3 bg-stone-50 dark:bg-stone-800/40 rounded-lg border border-stone-200 dark:border-stone-700">
                  Item is stored across Central Distribution Center primary racks.
                </p>
              )}
            </div>

            {/* Batch & Expiry Records if Tracked */}
            {selectedProduct.trackBatchExpiry && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Active Batches & Expiry Dates
                </span>
                {selectedProduct.batches && selectedProduct.batches.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedProduct.batches.map((b: any) => (
                      <div
                        key={b.id}
                        className="p-2 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <span className="font-bold text-stone-800 dark:text-stone-200">{b.batchNumber}</span>
                          <span className="text-stone-400 ml-2">Exp: {b.expiryDate ? b.expiryDate.slice(0, 10) : 'N/A'}</span>
                        </div>
                        <span className="font-bold text-stone-900 dark:text-stone-100">{b.quantity} units</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">No specific batch numbers assigned yet.</p>
                )}
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(selectedProduct.totalStock === 0 || selectedProduct.totalStock <= selectedProduct.reorderThreshold) && (
                  <button
                    onClick={() => {
                      handleInstantAutoOrder(selectedProduct);
                    }}
                    disabled={autoOrderingSku === selectedProduct.sku}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{autoOrderingSku === selectedProduct.sku ? 'Ordering...' : '⚡ 1-Click Auto-Order'}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onQuickReorder(selectedProduct.sku);
                    setSelectedProduct(null);
                  }}
                  className="px-3 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold transition"
                >
                  Create PO Review
                </button>
                <button
                  onClick={() => {
                    handleOpenEdit(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="px-3 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Specifications</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
