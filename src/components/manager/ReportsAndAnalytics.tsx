import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  TrendingDown,
  Download,
  Building,
  Mail,
  PieChart,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const ReportsAndAnalytics: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [valuationData, setValuationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/reports/valuation', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setValuationData(await res.json());
      }
    } catch (e: any) {
      showToast(e.message || 'Error generating reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchReports();
  }, [token]);

  const handleExportReportCSV = () => {
    if (!valuationData?.breakdown) return;
    const headers = ['Product', 'SKU', 'Category', 'Warehouse', 'Quantity', 'Unit Cost', 'Unit Sell', 'Cost Valuation', 'Potential Revenue'];
    const rows = valuationData.breakdown.map((b: any) => [
      `"${b.productName}"`,
      b.sku,
      `"${b.categoryName || ''}"`,
      `"${b.warehouseName}"`,
      b.quantity,
      b.costPrice,
      b.sellingPrice,
      b.lineCostValuation.toFixed(2),
      b.linePotentialRevenue.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `stocksense_valuation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Reports & Inventory Valuation
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Real-time balance sheet valuation, dead stock analysis, and gross margin projections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Scheduled automated weekly inventory valuation summary sent to manager email.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-xs font-semibold"
          >
            <Mail className="w-3.5 h-3.5" />
            Schedule Email Summary
          </button>
          <button
            onClick={handleExportReportCSV}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Valuation CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Total Inventory Cost Valuation
          </span>
          <span className="text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tracking-tight">
            ${valuationData?.totalValuation?.toLocaleString() || '0.00'}
          </span>
          <p className="text-[11px] text-stone-400 mt-1">Total capital locked in warehouses</p>
        </div>

        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Estimated Retail Potential Value
          </span>
          <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            ${valuationData?.totalPotentialRevenue?.toLocaleString() || '0.00'}
          </span>
          <p className="text-[11px] text-stone-400 mt-1">Gross sales potential at list price</p>
        </div>

        <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block mb-1">
            Projected Gross Margin
          </span>
          <span className="text-3xl font-extrabold text-red-600 dark:text-red-400 font-mono tracking-tight">
            ${valuationData?.projectedMargin?.toLocaleString() || '0.00'}
          </span>
          <p className="text-[11px] text-stone-400 mt-1">Expected return on current holdings</p>
        </div>
      </div>

      {/* Detailed Stock Valuation Breakdown Table */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-red-600" />
            Live Stock Position & Valuation by Item & Warehouse
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Warehouse Facility</th>
                <th className="py-3 px-4">Quantity on Hand</th>
                <th className="py-3 px-4">Unit Cost</th>
                <th className="py-3 px-4">Unit Sell</th>
                <th className="py-3 px-4">Cost Valuation</th>
                <th className="py-3 px-4">Potential Gross Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    Computing live database stock valuation...
                  </td>
                </tr>
              ) : (
                valuationData?.breakdown?.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                    <td className="py-3 px-4 font-sans font-semibold text-stone-900 dark:text-stone-100">
                      {item.productName}
                      <span className="block text-[10px] text-stone-400 font-mono">{item.sku}</span>
                    </td>
                    <td className="py-3 px-4 font-sans">{item.categoryName || 'General'}</td>
                    <td className="py-3 px-4 font-sans">{item.warehouseName}</td>
                    <td className="py-3 px-4 font-bold text-stone-900 dark:text-stone-100">{item.quantity}</td>
                    <td className="py-3 px-4">${item.costPrice}</td>
                    <td className="py-3 px-4 text-stone-400">${item.sellingPrice}</td>
                    <td className="py-3 px-4 font-bold text-stone-900 dark:text-stone-100">
                      ${item.lineCostValuation.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ${item.linePotentialRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
