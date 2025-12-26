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

  // const organizationSchema = {
  //   "@context": "https://schema.org",
  //   "@type": "Organization",
  //   name: "Vierra Development",
  //   url: "https://vierradev.com",
  //   logo: "https://vierradev.com/assets/meta-banner.png",
  //   contactPoint: {
  //     "@type": "Contact",
  //     telephone: "+1-781-496-8867",
  //     contactType: "Sales",
  //   },
  //   sameAs: [
  //     "https://www.linkedin.com/company/vierra/",
  //   ],
  // };

  // CRITICAL FIX: Don't render html/head tags in client component
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