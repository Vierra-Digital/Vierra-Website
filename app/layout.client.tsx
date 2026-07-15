"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import ConsentBanner from "@/components/ConsentBanner";
import {
  initializeAnalytics,
  storeAnalyticsData,
  checkAnalyticsStatus,
} from "@/lib/analytics";

interface ClientLayoutProps {
  children: React.ReactNode;
}
if (typeof window !== "undefined") {
  const originalError = console.error.bind(console)
  const errorInterceptor = (...args: any[]) => {
    const errorText = args.map(arg => String(arg || "")).join(" ")
    if (
      errorText.includes("GLTFLoader") &&
      errorText.includes("Couldn't load texture") &&
      (errorText.includes("blob:") || errorText.includes("blob:http"))
    ) {
      return
    }
    try {
      originalError.apply(console, args)
    } catch {
      originalError(...args)
    }
  }
  try {
    Object.defineProperty(console, "error", {
      value: errorInterceptor,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    try {
      console.error = errorInterceptor
    } catch {
      try {
        new Proxy(console, {
          get(target, prop) {
            if (prop === "error") {
              return errorInterceptor
            }
            return target[prop as keyof Console]
          }
        })
      } catch {
      }
    }
  }
}

export default function RootLayoutClient({
  children,
}: ClientLayoutProps) {
  // Real-user Core Web Vitals → GA4 as events (field LCP/INP/CLS/FCP/TTFB without
  // needing the CrUX/PSI API key). CLS is scaled x1000 per GA convention.
  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    if (typeof w.gtag !== "function") return;
    w.gtag("event", metric.name, {
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_rating: metric.rating,
      non_interaction: true,
    });
  });

  // Analytics validation runs in the background as a side effect. It must NOT
  // gate rendering: blocking children behind this client-only fetch left every
  // App Router page server-rendering only a spinner (no <h1>, no content) until
  // JS executed and the request resolved — invisible to crawlers and slow for users.
  useEffect(() => {
    const validateAnalytics = async () => {
      if (checkAnalyticsStatus()) return;
      const result = await initializeAnalytics();
      storeAnalyticsData(result);
    };
    validateAnalytics();
    const intervalId = setInterval(validateAnalytics, 3600000);
    return () => clearInterval(intervalId);
  }, []);
  useEffect(() => {
    const cleanupServiceWorkerCache = async () => {
      if (typeof window === "undefined") return;
      const cleanupKey = "__vierra_sw_cleanup_v1";
      if (window.localStorage.getItem(cleanupKey) === "done") return;
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          const appCaches = cacheNames.filter((name) => name.startsWith("vierra-"));
          await Promise.all(appCaches.map((name) => caches.delete(name)));
        }
        window.localStorage.setItem(cleanupKey, "done");
      } catch (error) {
        console.error("Service worker cleanup failed:", error);
      }
    };
    cleanupServiceWorkerCache();
  }, []);

  return (
    <div className="antialiased">
      {children}
      <ConsentBanner />
    </div>
  );
}