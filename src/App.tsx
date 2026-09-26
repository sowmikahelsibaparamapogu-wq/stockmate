import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import { useToast } from './context/ToastContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Dashboard } from './components/manager/Dashboard.tsx';
import { ProductManagement } from './components/manager/ProductManagement.tsx';
import { SuppliersAndPO } from './components/manager/SuppliersAndPO.tsx';
import { OperationsManager } from './components/manager/OperationsManager.tsx';
import { WarehousesAndStaff } from './components/manager/WarehousesAndStaff.tsx';
import { ReportsAndAnalytics } from './components/manager/ReportsAndAnalytics.tsx';
import { StaffPortal } from './components/staff/StaffPortal.tsx';
import { NotificationsCenter } from './components/common/NotificationsCenter.tsx';
import { ProfilePage } from './components/common/ProfilePage.tsx';
import { LoginPortal } from './components/auth/LoginPortal.tsx';

export default function App() {
  const { user, dbUser, loading, signInWithGoogle, activeRole } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [preFillReorderSku, setPreFillReorderSku] = useState<string | undefined>(undefined);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshData = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Poll notifications count
  useEffect(() => {
    if (!user) return;
    const checkNotifications = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const list = await res.json();
          setUnreadNotifications(list.filter((n: any) => !n.isRead).length);
        }
      } catch (e) {
        // silent
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle switching portals
  useEffect(() => {
    if (activeRole === 'staff') {
      if (['dashboard', 'products', 'suppliers_pos', 'warehouses_staff', 'reports'].includes(currentTab)) {
        setCurrentTab('staff_tasks');
      }
    } else {
      if (['staff_tasks', 'staff_receipts', 'staff_deliveries', 'staff_transfers', 'staff_stock_count', 'staff_scan'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    }
  }, [activeRole]);

  const handleQuickReorder = (sku: string) => {
    setPreFillReorderSku(sku);
    setCurrentTab('suppliers_pos');
    showToast(`Calculated auto-reorder pre-filled for ${sku}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 animate-pulse flex items-center justify-center text-white font-black">
            SS
          </div>
          <span className="text-xs font-semibold text-stone-500">Connecting to StockSense database...</span>
        </div>
      </div>
    );
  }

  // Authentication Wall: Red Aesthetic Warehouse Dual Portal Login
  if (!user) {
    return <LoginPortal onLoginSuccess={handleRefreshData} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col md:flex-row antialiased">
      {/* Left Sidebar Navigation with Portals, Tabs, Demo Operations, and Profile */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        unreadCount={unreadNotifications}
        onRefreshData={handleRefreshData}
      />

      {/* Main Content Viewport on the Right */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        <main key={`${activeRole}-${refreshKey}`} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Manager Views */}
        {activeRole === 'manager' && (
          <>
            {currentTab === 'dashboard' && (
              <Dashboard
                onQuickReorder={handleQuickReorder}
                onNavigateTab={setCurrentTab}
              />
            )}
            {currentTab === 'products' && (
              <ProductManagement onQuickReorder={handleQuickReorder} />
            )}
            {currentTab === 'suppliers_pos' && (
              <SuppliersAndPO
                initialPreFillSku={preFillReorderSku}
                onClearPreFill={() => setPreFillReorderSku(undefined)}
              />
            )}
            {currentTab === 'operations' && <OperationsManager />}
            {currentTab === 'warehouses_staff' && <WarehousesAndStaff />}
            {currentTab === 'reports' && <ReportsAndAnalytics />}
          </>
        )}

        {/* Staff Views */}
        {activeRole === 'staff' && (
          <StaffPortal
            currentTab={currentTab}
            onNavigateTab={setCurrentTab}
          />
        )}

        {/* Shared Views */}
        {currentTab === 'notifications' && (
          <NotificationsCenter
            onQuickReorder={handleQuickReorder}
            onNavigateTab={setCurrentTab}
          />
        )}
        {currentTab === 'profile' && <ProfilePage />}
      </main>
      </div>
    </div>
  );
}
