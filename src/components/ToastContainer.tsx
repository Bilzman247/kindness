import React from 'react';
import { ToastItem } from '../types';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-3 inset-x-3 z-50 flex flex-col gap-2 pointer-events-none transition-all">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start justify-between gap-2.5 p-3 rounded-2xl shadow-lg border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              isSuccess
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-500/10'
                : isError
                ? 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-500/10'
                : isWarning
                ? 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-500/10'
                : 'bg-blue-50/95 border-blue-300 text-blue-950 shadow-blue-500/10'
            }`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-600" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                {isInfo && <Info className="w-4 h-4 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs leading-snug tracking-tight text-slate-900">
                  {toast.title}
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-700 mt-0.5 break-words">
                  {toast.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
