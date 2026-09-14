import React from "react"
import { FiCheck, FiX } from "react-icons/fi"
import Modal from "@/components/ui/Modal"
import { inter } from "@/lib/fonts"

type ActionResultModalProps = {
  isOpen: boolean
  /** Which face to show. The caller supplies wording for the outcome it is reporting. */
  success: boolean
  title: string
  message: React.ReactNode
  onClose: () => void
  closeLabel?: string
}

/**
 * The panel's "that worked" / "that didn't" dialog.
 *
 * Written once because it was being written per feature: the same ringed tick, the same heading
 * and paragraph, the same full-width button, drifting a shade apart each time. Reporting an
 * outcome in a dialog is also the alternative to reporting it in an alert(), which is what
 * rescinding an invite did.
 */
const ActionResultModal: React.FC<ActionResultModalProps> = ({
  isOpen,
  success,
  title,
  message,
  onClose,
  closeLabel = "Close",
}) => {
  if (!isOpen) return null

  return (
    <Modal
      zIndexClass="z-[200]"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
      label={title}
      onClose={onClose}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
          {/* The ping is the success tell — a failure should not look celebratory. */}
          {success && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-30" />
          )}
          <span
            className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full ${
              success ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                success ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {success ? <FiCheck className="h-6 w-6" /> : <FiX className="h-6 w-6" />}
            </span>
          </span>
        </div>
        <h3 className="mb-2 text-xl font-semibold text-[#111827]">{title}</h3>
        <p className={`mb-6 text-sm text-[#6B7280] ${inter.className}`}>{message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            success ? "bg-[#701CC0] hover:bg-[#5f17a5]" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {closeLabel}
        </button>
      </div>
    </Modal>
  )
}

export default ActionResultModal
