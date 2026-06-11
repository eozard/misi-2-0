/*
 * Reusable confirm dialog for destructive actions.
 */
import React from "react";

const toneClassMap = {
  danger: "btn-danger",
  primary: "btn-primary",
  neutral: "btn-secondary",
};

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  tone = "danger",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={toneClassMap[tone] || "btn-primary"}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
