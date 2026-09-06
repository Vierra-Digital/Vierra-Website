"use client";

import { useEffect, useState } from "react";

const PROVIDER_LABELS: Record<string, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  googleads: "Google Ads",
};

const REASON_MESSAGES: Record<string, string> = {
  access_denied: "Permission was denied.",
  missing_code: "The connection was cancelled.",
  invalid_session: "This onboarding link has expired.",
  token_exchange_failed: "The connection could not be completed.",
  no_access_token: "The connection could not be completed.",
};

/**
 * Shared landing page for every provider's onboarding-context OAuth failure (denied consent,
 * expired session, a failed token exchange, ...) — mirrors app/{facebook,linkedin,googleads}/
 * connected's success pattern: post a message to the opener and close, instead of leaving the
 * popup showing a bare error string with nothing telling the original tab what happened.
 */
export default function SocialConnectFailedPage() {
  const [provider, setProvider] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    // window.location isn't available during the first render, so the query string can only be
    // read here, not derived as initial state.
    const params = new URLSearchParams(window.location.search);
    const p = params.get("provider") || "";
    const r = params.get("reason") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(p);
    setReason(r);

    try {
      window.opener?.postMessage({ type: "social-connect-failed", provider: p, reason: r }, window.location.origin);
    } catch {}

    const closeWindow = () => {
      try {
        window.close();
      } catch {}
    };
    const quickClose = setTimeout(closeWindow, 1500);
    const retryClose = setTimeout(closeWindow, 3000);
    return () => {
      clearTimeout(quickClose);
      clearTimeout(retryClose);
    };
  }, []);

  const providerLabel = PROVIDER_LABELS[provider] || "the account";
  const message = REASON_MESSAGES[reason] || "The connection could not be completed.";

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="relative inline-flex h-16 w-16 items-center justify-center">
        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        </span>
      </div>
      <p className="text-lg font-semibold text-[#111827]">{providerLabel} wasn&apos;t connected</p>
      <p className="max-w-sm text-sm text-[#6B7280]">{message}</p>
      <p className="text-sm text-[#9CA3AF]">This window will close automatically...</p>
    </div>
  );
}
