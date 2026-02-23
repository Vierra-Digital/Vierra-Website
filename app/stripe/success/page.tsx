"use client";

import { useEffect } from "react";

export default function StripeSuccessPage() {
  useEffect(() => {
    try {
      window.opener?.postMessage("stripe-connected", window.location.origin);
    } catch {}

    const closeWindow = () => {
      try { window.close(); } catch {}
    };

    const quickClose = setTimeout(closeWindow, 200);
    const retryClose = setTimeout(closeWindow, 1200);
    return () => {
      clearTimeout(quickClose);
      clearTimeout(retryClose);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center gap-4">
      <div className="relative inline-flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </span>
      </div>
      <p className="text-lg font-semibold text-[#111827]">Payment Method Connected</p>
      <p className="text-sm text-[#6B7280]">This window will close automatically...</p>
    </div>
  );
}
