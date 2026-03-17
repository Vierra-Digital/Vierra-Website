"use client";

import { useEffect, useState } from "react";
import {
  initializeAnalytics,
  storeAnalyticsData,
  checkAnalyticsStatus,
} from "@/lib/analytics";

interface ClientLayoutProps {
  children: React.ReactNode;
  geistSansVariable: string;
  geistMonoVariable: string;
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
  geistSansVariable,
  geistMonoVariable,
}: ClientLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);

  const validateAnalytics = async () => {
    setIsLoading(true);
    if (checkAnalyticsStatus()) {
      setIsLoading(false);
      return;
    }
    const result = await initializeAnalytics();
    storeAnalyticsData(result);
    setIsLoading(false);
  };

  useEffect(() => {
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
    <>
      <div className={`${geistSansVariable} ${geistMonoVariable} antialiased`}>
        {isLoading ? (
          <div className="flex h-screen w-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8F42FF]"></div>
          </div>
        ) : (
          <>{children}</>
        )}
      </div>
    </>
  );
}