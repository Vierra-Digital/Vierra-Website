import React from "react";
import { FiAlertTriangle } from "react-icons/fi";
import Modal from "@/components/ui/Modal";

type ConfirmActionModalProps = {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  /** Render on the email panel's dark surface instead of the default light card. */
  dark?: boolean;
  /** Keep the dialog open and prevent duplicate actions while the request is pending. */
  busy?: boolean;
  busyLabel?: string;
  error?: string;
};

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = true,
  dark = false,
  busy = false,
  busyLabel = "Working…",
  error,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      onClose={() => { if (!busy) onCancel(); }}
      label={title}
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName={`rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${dark ? "email-dialog-dark" : "bg-white"}`}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? "bg-red-100" : "bg-amber-100"}`}>
            <FiAlertTriangle className={`w-6 h-6 ${danger ? "text-red-600" : "text-amber-600"}`} />
          </div>
          <h3 className="text-xl font-semibold text-[#111827]">{title}</h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-6">{message}</p>
        {error && <p role="alert" className={`mb-4 text-sm ${dark ? "text-red-300" : "text-red-700"}`}>{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? "border-white/12 text-[#C9C4DC] hover:bg-white/5" : "border-[#E5E7EB] text-[#374151] hover:bg-gray-50"}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#701CC0] hover:bg-[#5f17a5]"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
    </Modal>
  );
};

export default ConfirmActionModal;
