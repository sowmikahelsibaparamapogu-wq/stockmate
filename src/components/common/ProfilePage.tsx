import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Key,
  Building,
  CheckCircle2,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const ProfilePage: React.FC = () => {
  const { dbUser, token, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(dbUser?.name || '');
  const [twoFactor, setTwoFactor] = useState(dbUser?.twoFactorEnabled || false);
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          twoFactorEnabled: twoFactor,
        }),
      });

      if (res.ok) {
        showToast('Profile security settings updated successfully');
        await refreshProfile();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          User Profile & Credentials
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Manage your personal details, access role, and Two-Factor Authentication (TOTP).
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs">
        <form onSubmit={handleUpdate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
              Registered Account Email
            </label>
            <input
              type="text"
              disabled
              value={dbUser?.email || ''}
              className="w-full bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-lg p-2.5 text-stone-500 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">Role Permissions</label>
            <div className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-lg font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wide">
              {dbUser?.role}
            </div>
          </div>

          {/* 2FA TOTP Toggle */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  Two-Factor Authentication (TOTP 2FA)
                </span>
                <p className="text-stone-500 mt-0.5 text-xs">
                  Enforce hardware security or authenticator application login.
                </p>
              </div>

              <input
                type="checkbox"
                checked={twoFactor}
                onChange={(e) => setTwoFactor(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-stone-300"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Profile Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
