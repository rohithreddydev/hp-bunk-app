import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_MAP = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', icon_color: 'text-emerald-600', bar: 'bg-emerald-500' },
  error:   { icon: XCircle,    bg: 'bg-red-50',     border: 'border-red-200',     icon_color: 'text-red-600',     bar: 'bg-red-500' },
  warning: { icon: AlertCircle,bg: 'bg-amber-50',   border: 'border-amber-200',   icon_color: 'text-amber-600',   bar: 'bg-amber-500' },
  info:    { icon: Info,       bg: 'bg-blue-50',    border: 'border-blue-200',    icon_color: 'text-blue-600',    bar: 'bg-blue-500' },
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = TYPE_MAP[t.type];
  const Icon = cfg.icon;
  const dur = t.duration ?? 3500;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), dur);
    return () => clearTimeout(timer);
  }, [t.id, dur, onDismiss]);

  return (
    <div
      className={`flex gap-3 items-start w-full max-w-sm rounded-2xl border ${cfg.bg} ${cfg.border} shadow-lg p-4 relative overflow-hidden animate-in slide-in-from-right-5 fade-in duration-300`}
      role="alert"
    >
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${cfg.bar} animate-[shrink_var(--dur)_linear_forwards]`}
        style={{ '--dur': `${dur}ms` } as React.CSSProperties}
      />
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.icon_color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{t.title}</p>
        {t.message && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{t.message}</p>}
      </div>
      <button onClick={() => onDismiss(t.id)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { ...opts, id }]); // max 5 toasts
  }, []);

  const value: ToastContextValue = {
    toast,
    success: (title, message) => toast({ type: 'success', title, message }),
    error:   (title, message) => toast({ type: 'error',   title, message }),
    warning: (title, message) => toast({ type: 'warning', title, message }),
    info:    (title, message) => toast({ type: 'info',    title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — bottom-right on desktop, bottom-center on mobile */}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
