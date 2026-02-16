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
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
          if (navigator.serviceWorker.controller) {
            console.log("Service Worker is controlling the page");
          }
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
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