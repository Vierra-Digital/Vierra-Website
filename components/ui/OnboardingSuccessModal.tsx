import React from "react";
import { useRouter } from "next/router";
import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

interface OnboardingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function OnboardingSuccessModal({ 
  isOpen, 
  onClose, 
  token 
}: OnboardingSuccessModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleProceed = () => {
    router.push(`/session/client/${token}`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h1 className={`text-2xl font-bold text-gray-900 mb-4 ${bricolage.className}`}>
            Onboarding Successful
          </h1>
          
          <p className="text-gray-600 mb-8">
            Your onboarding to Vierra Digitals is successful
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
              Proceed to Modules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
