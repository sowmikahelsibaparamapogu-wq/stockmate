import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface NotificationsCenterProps {
  onQuickReorder: (sku: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  onQuickReorder,
  onNavigateTab,
}) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e: any) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchNotifications();
  }, [token]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/notifications/${id}/acknowledge`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, ...updated, isRead: true } : n))
        );
        showToast('Notification acknowledged and recorded for sender.', 'success');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = (n: any) => {
    handleMarkAsRead(n.id);
    if (n.actionUrl && n.actionUrl.includes('sku=')) {
      const match = n.actionUrl.match(/sku=([^&]+)/);
      if (match && match[1]) {
        onQuickReorder(match[1]);
        return;
      }
    }
    if (n.actionUrl === '/operations') {
      onNavigateTab('operations');
    } else if (n.actionUrl === '/staff/delivery-orders') {
      onNavigateTab('staff_deliveries');
    } else if (n.actionUrl === '/staff/receipts') {
      onNavigateTab('staff_receipts');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            Alerts & Notifications
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Real-time low-stock escalations, pending approvals, out-of-stock emergency alerts, and task dispatches.
          </p>
        </div>

        <button
          onClick={fetchNotifications}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50"
        >
          Refresh Feed
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-stone-400 text-xs">Loading alerts...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs">No notifications yet. System is healthy.</div>
        ) : (
          notifications.map((n) => {
            const isOutOfStock = n.type === 'out_of_stock';
            const isLow = n.type === 'low_stock';
            const isApproval = n.type === 'approval_pending';

            return (
              <div
                key={n.id}
                className={`p-4 transition flex items-start justify-between gap-4 ${
                  !n.isRead ? 'bg-red-50/20 dark:bg-red-950/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isOutOfStock ? (
                      <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                    ) : isLow ? (
                      <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600">
                        <Clock className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">{n.title}</h4>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{n.message}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="text-[10px] text-stone-400 font-mono">
                        {n?.createdAt ? new Date(n.createdAt).toLocaleString() : 'Recently'}
                      </span>

                      {/* Two-Way Acknowledgment Status Indicator */}
                      {n.acknowledgedAt ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <CheckCheck className="w-3 h-3" />
                          <span>
                            Seen / Acknowledged by {n.acknowledgedBy?.name || 'Staff'}{' '}
                            ({n.acknowledgedAt ? new Date(n.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'})
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(n.id)}
                          className="inline-flex items-center gap-1 text-[10px] text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 font-medium transition"
                        >
                          <CheckCircle2 className="w-3 h-3 text-stone-400" />
                          <span>Mark Seen / Acknowledge</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.actionUrl && (
                    <button
                      onClick={() => handleAction(n)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                    >
                      {isOutOfStock || isLow ? <ShoppingBag className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      {isOutOfStock || isLow ? 'Reorder Now' : 'View Task'}
                    </button>
                  )}
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      title="Mark as read"
                      className="p-1.5 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
