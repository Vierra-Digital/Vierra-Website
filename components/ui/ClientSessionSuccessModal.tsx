import React from "react";
import { useRouter } from "next/router";
import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

interface ClientSessionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export default function ClientSessionSuccessModal({ isOpen, onClose }: ClientSessionSuccessModalProps) {
  const router = useRouter();

  const handleProceed = () => {
    router.push("/");
    onClose?.();
  };

  const handleOverlayClick = () => {
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
      <div className="bg-white rounded-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center">
                <div className="w-12 h-12 bg-green-300 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <h1 className={`text-2xl font-bold text-gray-900 mb-4 ${bricolage.className}`}>
            Modules Completed Successfully
          </h1>
          
          <p className="text-gray-600 mb-8">
            You&apos;ve completed all modules. Thank you for your time!
          </p>
          
          <div className="flex justify-center gap-4">
            <button
              onClick={onClose}
              className={`px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition ${bricolage.className}`}
            >
              Close
            </button>
            <button
              onClick={handleProceed}
              className={`px-8 py-3 bg-[#7A13D0] text-white rounded-lg font-semibold hover:bg-[#6B11B8] transition ${bricolage.className}`}
            >
              Go back to homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
