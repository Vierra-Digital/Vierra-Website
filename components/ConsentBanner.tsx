"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * GDPR / ePrivacy consent gate for analytics.
 *
 * - Google Analytics uses Consent Mode v2: the gtag snippet in app/layout.tsx and
 *   pages/_app.tsx sets all consent signals to "denied" by default, so GA loads
 *   but stores nothing (modeled/cookieless) until the visitor accepts here.
 *
 * The choice is remembered in localStorage; the banner only shows to visitors who
 * haven't chosen yet. Rendered in both routers (app/layout.client.tsx + _app.tsx).
 */
const CONSENT_KEY = "vierra_consent_v1";

type Gtag = (...args: unknown[]) => void;

function grantConsent() {
  const w = window as unknown as { gtag?: Gtag };
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
  }
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      // localStorage blocked (private mode / cookies off) — show the banner.
    }
    if (stored === "granted") {
      grantConsent(); // returning visitor who already opted in
      return;
    }
    if (stored === "denied") return; // already declined — stay hidden

    // No choice made yet: hold the banner back until the visitor scrolls into
    // the page, so it doesn't cover the hero the instant they land.
    const REVEAL_AT = 300; // px
    if (window.scrollY > REVEAL_AT) {
      setVisible(true);
      return;
    }
    const onScroll = () => {
      if (window.scrollY > REVEAL_AT) {
        setVisible(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const decide = (choice: "granted" | "denied") => {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // ignore — choice just won't persist across sessions
    }
    if (choice === "granted") grantConsent();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="Cookie consent"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-[300] mx-auto flex max-w-3xl flex-col gap-3 border border-white/10 bg-[#18042A]/95 p-5 text-white shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:flex-row sm:items-center sm:rounded-2xl"
        >
      <p className="flex-1 text-sm leading-6 text-white/80">
        We use cookies for analytics to understand how visitors use our site and improve it.{" "}
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#C99DFF] underline underline-offset-2 hover:text-white"
        >
          Privacy Policy
        </a>
      </p>
      <div className="flex shrink-0 gap-3">
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => decide("granted")}
          className="rounded-lg bg-[#701CC0] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8F42FF]"
        >
          Accept
        </button>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
