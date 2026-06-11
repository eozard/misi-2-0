/*
 * Toast stack for success/error/warning/info notifications.
 */
import React from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const toneClassMap = {
  success: "toast-success",
  error: "toast-error",
  warning: "toast-warning",
  info: "toast-info",
};

const ToastStack = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type] || Info;
        const toneClass = toneClassMap[toast.type] || toneClassMap.info;

        return (
          <div
            key={toast.id}
            className={`toast ${toneClass} toast-enter`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="toast-icon">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                {toast.title && <p className="toast-title">{toast.title}</p>}
                <p className="toast-message">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="toast-close"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ToastStack;
