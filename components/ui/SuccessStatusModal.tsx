import React from "react";
import { FiCheck } from "react-icons/fi";

type SuccessStatusModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonLabel?: string;
};

const SuccessStatusModal: React.FC<SuccessStatusModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  buttonLabel = "Done",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <FiCheck className="h-6 w-6" />
              </span>
            </span>
          </div>
          <h3 className="text-xl font-semibold text-[#111827] mb-2">{title}</h3>
          <p className="text-sm text-[#6B7280] mb-6">{message}</p>
          <button
            className="w-full rounded-lg px-4 py-2 text-sm font-medium bg-[#701CC0] text-white hover:bg-[#5f17a5] transition-colors"
            onClick={onClose}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessStatusModal;
