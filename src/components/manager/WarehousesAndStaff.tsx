import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Shield,
  Plus,
  Activity,
  UserCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const WarehousesAndStaff: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Warehouse Modal
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [whForm, setWhForm] = useState({
    name: '',
    code: '',
    address: '',
    city: 'Singapore',
  });

  // New Location Modal
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [selectedWhId, setSelectedWhId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState({
    name: '',
    code: '',
    zone: 'Zone A',
    type: 'storage',
  });

  // Presets Handlers
  const applyWhPreset = (preset: { name: string; code: string; address: string; city: string }) => {
    setWhForm({
      ...preset,
      code: `${preset.code}-${Math.floor(10 + Math.random() * 90)}`,
    });
    showToast(`Loaded facility preset: "${preset.name}"`);
  };

  const applyLocPreset = (preset: { name: string; code: string; zone: string; type: string }) => {
    setLocForm({
      ...preset,
      code: `${preset.code}-${Math.floor(100 + Math.random() * 900)}`,
    });
    showToast(`Loaded bin preset: "${preset.name}"`);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wRes, sRes, aRes] = await Promise.all([
        fetch('/api/v1/warehouses', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/staff', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (wRes.ok) setWarehouses(await wRes.json());
      if (sRes.ok) setStaff(await sRes.json());
      if (aRes.ok) setAuditLogs(await aRes.json());
    } catch (e: any) {
      showToast(e.message || 'Error loading warehouses & staff', 'error');
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
        if (isWhModalOpen) setIsWhModalOpen(false);
        else if (isLocModalOpen) setIsLocModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWhModalOpen, isLocModalOpen]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/warehouses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(whForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create warehouse');
      }

      showToast('Warehouse facility created with default zones & dock.');
      setIsWhModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWhId) return;
    try {
      const res = await fetch('/api/v1/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...locForm,
          warehouseId: selectedWhId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add location');
      }

      showToast('Bin location added to warehouse layout.');
      setIsLocModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateStaffRole = async (staffId: number, role: string, assignedWarehouseId?: number) => {
    try {
      const res = await fetch(`/api/v1/staff/${staffId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role, assignedWarehouseId }),
      });

      if (res.ok) {
        showToast('Staff role & warehouse assignment updated');
        fetchData();
      }
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
            Warehouses, Storage Bins & Staff
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Facility physical layouts, zones, racks, staff accounts, and comprehensive audit trail.
          </p>
        </div>

        <button
          onClick={() => {
            setWhForm({
              name: '',
              code: `CDC-${Date.now().toString().slice(-3)}`,
              address: '',
              city: 'Singapore',
            });
            setIsWhModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Warehouse Facility
        </button>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs"
          >
            <div className="flex items-start justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">{wh.name}</h3>
                <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {wh.address}, {wh.city}
                </p>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 font-bold">
                {wh.code}
              </span>
            </div>

            {/* Locations / Bins within this warehouse */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Storage Locations ({wh.locations?.length || 0})
                </span>
                <button
                  onClick={() => {
                    setSelectedWhId(wh.id);
                    setLocForm({
                      name: '',
                      code: `${wh.code}-LOC-${Date.now().toString().slice(-3)}`,
                      zone: 'Zone A',
                      type: 'storage',
                    });
                    setIsLocModalOpen(true);
                  }}
                  className="text-[11px] text-red-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Location
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {wh.locations?.map((loc: any) => (
                  <div
                    key={loc.id}
                    className="p-2 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 text-xs"
                  >
                    <span className="font-semibold text-stone-800 dark:text-stone-200 block truncate">
                      {loc.name}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono block">{loc.code}</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold mt-1 inline-block">
                      {loc.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Role & Assignments Table */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-red-600" />
              Staff Accounts & Access Control ({staff.length})
            </h3>
            <p className="text-xs text-stone-500">
              Role permissions and primary assigned warehouse facility.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Assigned Warehouse</th>
                <th className="py-3 px-4">2FA Security</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                  <td className="py-3.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                    {u.name || 'Staff User'}
                  </td>
                  <td className="py-3.5 px-4 font-mono">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        u.role === 'manager'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                          : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    {u.assignedWarehouse?.name || 'All Facilities'}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {u.twoFactorEnabled ? (
                      <span className="text-emerald-600 font-bold">Enabled</span>
                    ) : (
                      <span className="text-stone-400">Disabled</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() =>
                        handleUpdateStaffRole(
                          u.id,
                          u.role === 'manager' ? 'staff' : 'manager',
                          u.assignedWarehouseId
                        )
                      }
                      className="px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-semibold text-[11px]"
                    >
                      Switch to {u.role === 'manager' ? 'Staff' : 'Manager'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log (Cross-Entity Traceability) */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 dark:border-stone-800">
          <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-600" />
            System Audit Trail (Who, What, When)
          </h3>
          <p className="text-xs text-stone-500">
            Immutable log of every create, update, delete, approval, and validation across all modules.
          </p>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs text-stone-600 dark:text-stone-300 font-mono">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Entity Type</th>
                <th className="py-2.5 px-4">Entity Reference</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-stone-400 font-sans">
                    No system audit logs found yet.
                  </td>
                </tr>
              ) : (
                auditLogs.filter(Boolean).map((log, idx) => {
                  const logItem = log.log || (log.id || log.action ? log : null) || {};
                  const createdAtRaw = logItem.createdAt || log.createdAt;
                  const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
                  const formattedDate =
                    createdAtDate && !isNaN(createdAtDate.getTime())
                      ? createdAtDate.toLocaleString()
                      : 'Recently';
                  const userName = log.user?.name || log.userName || 'System / Admin';
                  const action = logItem.action || log.action || 'AUDIT';
                  const entityType = logItem.entityType || log.entityType || 'SYSTEM';
                  const entityId = logItem.entityId || log.entityId || 'N/A';
                  const details =
                    typeof logItem.details === 'object'
                      ? JSON.stringify(logItem.details)
                      : String(logItem.details || log.details || '');

                  return (
                    <tr key={logItem.id || log.id || idx} className="hover:bg-stone-50/50">
                      <td className="py-2 px-4 text-stone-400 text-[10px]">
                        {formattedDate}
                      </td>
                      <td className="py-2 px-4 text-stone-800 dark:text-stone-200 font-sans">
                        {userName}
                      </td>
                      <td className="py-2 px-4 font-bold text-red-600">{action}</td>
                      <td className="py-2 px-4 uppercase text-[10px]">{entityType}</td>
                      <td className="py-2 px-4">{entityId}</td>
                      <td className="py-2 px-4 text-[10px] text-stone-400 truncate max-w-xs">{details}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Warehouse */}
      {isWhModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsWhModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">Add Warehouse Facility</h3>
                <p className="text-xs text-stone-500">Configure regional distribution center or depot</p>
              </div>
              <button
                onClick={() => setIsWhModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warehouse Presets */}
            <div className="mt-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Facility Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    applyWhPreset({
                      name: 'North Mega Logistics Hub',
                      code: 'WH-NORTH',
                      address: '25 International Business Park',
                      city: 'Singapore',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🏭 North Mega Hub
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyWhPreset({
                      name: 'Changi Air-Cargo Center',
                      code: 'WH-CHANGI',
                      address: '15 Changi North Way',
                      city: 'Singapore',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  ✈️ Changi Air-Cargo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyWhPreset({
                      name: 'Tuas Cold-Chain Terminal',
                      code: 'WH-TUAS',
                      address: '10 Tuas South Ave 4',
                      city: 'Singapore',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🧊 Tuas Cold-Chain
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-3 pt-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Facility Name *</label>
                <input
                  type="text"
                  required
                  value={whForm.name}
                  onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Code *</label>
                <input
                  type="text"
                  required
                  value={whForm.code}
                  onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Street Address</label>
                <input
                  type="text"
                  value={whForm.address}
                  onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">City</label>
                <input
                  type="text"
                  value={whForm.city}
                  onChange={(e) => setWhForm({ ...whForm, city: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsWhModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Create Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Location */}
      {isLocModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsLocModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100">Add Bin / Rack Location</h3>
                <p className="text-xs text-stone-500">Create addressable storage bin, rack, or receiving stage</p>
              </div>
              <button
                onClick={() => setIsLocModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Location Presets */}
            <div className="mt-3 p-2.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Rack / Bin Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    applyLocPreset({
                      name: 'High-Bay Pallet Rack A-01',
                      code: 'LOC-A01',
                      zone: 'Zone A - High Density',
                      type: 'storage',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  📦 High-Bay Storage
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyLocPreset({
                      name: 'Dock Inbound Receiving Stage',
                      code: 'LOC-DOCK',
                      zone: 'Receiving Dock West',
                      type: 'receiving',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  🚚 Dock Receiving Stage
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyLocPreset({
                      name: 'Cold Vault Refrigerated Bin C-02',
                      code: 'LOC-CR02',
                      zone: 'Refrigerated Cold Vault B',
                      type: 'storage',
                    })
                  }
                  className="px-2 py-1 bg-white dark:bg-stone-900 hover:border-red-400 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded text-[11px] font-semibold transition"
                >
                  ❄️ Cold Storage Bin
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3 pt-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack A-03-Bay 2"
                  value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Barcode / Code *</label>
                <input
                  type="text"
                  required
                  value={locForm.code}
                  onChange={(e) => setLocForm({ ...locForm, code: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Zone</label>
                <input
                  type="text"
                  value={locForm.zone}
                  onChange={(e) => setLocForm({ ...locForm, zone: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Type</label>
                <select
                  value={locForm.type}
                  onChange={(e) => setLocForm({ ...locForm, type: e.target.value })}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
                >
                  <option value="storage">Storage Rack/Bin</option>
                  <option value="receiving">Inbound Dock Receiving</option>
                  <option value="picking">Picking Staging Area</option>
                  <option value="shipping">Outbound Shipping Bay</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
