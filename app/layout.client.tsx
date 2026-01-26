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

// Set up global error interceptor for GLTFLoader blob URL errors
if (typeof window !== "undefined") {
  const originalError = console.error.bind(console)
  
  // Create a more aggressive interceptor that checks all arguments
  const errorInterceptor = (...args: any[]) => {
    // Check all arguments for the error pattern
    const errorText = args.map(arg => String(arg || "")).join(" ")
    
    // Suppress GLTFLoader blob URL texture errors
    if (
      errorText.includes("GLTFLoader") &&
      errorText.includes("Couldn't load texture") &&
      (errorText.includes("blob:") || errorText.includes("blob:http"))
    ) {
      // Completely suppress - return early without calling originalError
      return
    }
    
    // For all other errors, call the original
    try {
      originalError.apply(console, args)
    } catch {
      // Fallback if apply fails
      originalError(...args)
    }
  }
  
  // Try multiple methods to override console.error
  try {
    // Method 1: Direct property descriptor
    Object.defineProperty(console, "error", {
      value: errorInterceptor,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    try {
      // Method 2: Direct assignment
      console.error = errorInterceptor
    } catch {
      // Method 3: Use Proxy as last resort (not used but attempted)
      try {
        new Proxy(console, {
          get(target, prop) {
            if (prop === "error") {
              return errorInterceptor
            }
            return target[prop as keyof Console]
          }
        })
        // Note: This won't work if console is frozen, but worth trying
      } catch {
        // If all methods fail, at least we tried
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

  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
          
          // Check if service worker is controlling the page
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