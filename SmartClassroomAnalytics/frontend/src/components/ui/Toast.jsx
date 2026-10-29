import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const BORDER_MAP = {
  success: 'border-emerald-200 bg-emerald-50/95 text-emerald-900',
  error: 'border-rose-200 bg-rose-50/95 text-rose-900',
  warning: 'border-amber-200 bg-amber-50/95 text-amber-900',
  info: 'border-blue-200 bg-blue-50/95 text-blue-900',
};

const ICON_COLOR = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type] || Info;
        const colorClasses = BORDER_MAP[toast.type] || BORDER_MAP.info;
        const iconColor = ICON_COLOR[toast.type] || ICON_COLOR.info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-xs transition-all duration-200 ${colorClasses}`}
          >
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message && (
                <p className="text-xs mt-0.5 opacity-90 break-words">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="rounded-md p-1 hover:bg-black/5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
