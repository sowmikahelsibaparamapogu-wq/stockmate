import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'manager' | 'staff';
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  assignedWarehouseId?: number;
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  token: string | null;
  loading: boolean;
  activeRole: 'manager' | 'staff';
  signInWithGoogle: () => Promise<void>;
  loginAsDemo: (role: 'manager' | 'staff') => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: 'manager' | 'staff') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDbProfile = async (idToken: string) => {
    try {
      const res = await fetch('/api/v1/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  useEffect(() => {
    // Check if there was an active demo login session
    const savedDemoToken = localStorage.getItem('stocksense_demo_token');
    const savedDemoRole = (localStorage.getItem('stocksense_demo_role') as 'manager' | 'staff') || 'manager';

    if (savedDemoToken) {
      setToken(savedDemoToken);
      setUser({
        uid: savedDemoRole === 'manager' ? 'stocksense-system-admin' : 'stocksense-staff-demo',
        email: `${savedDemoRole}@stocksense.corp`,
        displayName: savedDemoRole === 'manager' ? 'Chief Inventory Manager' : 'Warehouse Operations Staff',
        getIdToken: async () => savedDemoToken,
      } as any);
      fetchDbProfile(savedDemoToken).finally(() => setLoading(false));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
          await fetchDbProfile(idToken);
        } catch (e) {
          console.error('Error fetching auth token:', e);
        }
      } else {
        setToken(null);
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAsDemo = async (role: 'manager' | 'staff') => {
    setLoading(true);
    try {
      const demoToken = role === 'manager' ? 'demo-token-manager' : 'demo-token-staff';
      localStorage.setItem('stocksense_demo_token', demoToken);
      localStorage.setItem('stocksense_demo_role', role);

      setToken(demoToken);
      setUser({
        uid: role === 'manager' ? 'stocksense-system-admin' : 'stocksense-staff-demo',
        email: `${role}@stocksense.corp`,
        displayName: role === 'manager' ? 'Chief Inventory Manager' : 'Warehouse Operations Staff',
        getIdToken: async () => demoToken,
      } as any);

      await fetchDbProfile(demoToken);
    } catch (err) {
      console.error('Demo Login failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      localStorage.removeItem('stocksense_demo_token');
      localStorage.removeItem('stocksense_demo_role');
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setToken(idToken);
      await fetchDbProfile(idToken);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('stocksense_demo_token');
    localStorage.removeItem('stocksense_demo_role');
    await fbSignOut(auth).catch(() => {});
    setUser(null);
    setDbUser(null);
    setToken(null);
  };

  const switchRole = async (role: 'manager' | 'staff') => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDbUser(updated);
      }
    } catch (e) {
      console.error('Error updating role:', e);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchDbProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        token,
        loading,
        activeRole: dbUser?.role || 'manager',
        signInWithGoogle,
        loginAsDemo,
        signOut,
        switchRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
