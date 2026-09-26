import React, { createContext, useContext, useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('stocksense_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('stocksense_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, theme, toggleTheme }}>
      {children}
      {/* Toast Overlay */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map(toast => {
          const bg =
            toast.type === 'success'
              ? 'bg-emerald-800 text-white'
              : toast.type === 'error'
              ? 'bg-red-800 text-white'
              : toast.type === 'warning'
              ? 'bg-amber-800 text-white'
              : 'bg-zinc-800 text-white';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-lg shadow-xl border border-white/10 flex items-center justify-between text-sm font-medium transition-all transform translate-y-0 opacity-100 ${bg}`}
            >
              <span>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-3 text-white/70 hover:text-white text-xs uppercase font-bold"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
