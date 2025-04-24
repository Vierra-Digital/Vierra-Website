"use client";
import { Geist, Geist_Mono } from "next/font/google";
import {
  initializeAnalytics,
  storeAnalyticsData,
  checkAnalyticsStatus,
} from "@/lib/analytics";
import { useEffect, useState } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <title>Vierra</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta
          name="keywords"
          content="marketing, lead generation, business growth, digital optimization"
        />
        <meta name="author" content="Darsh Doshi" />
        <meta property="og:title" content="Vierra" />
        <meta
          property="og:description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta property="og:image" content="/assets/vierra-logo.png" />
        <meta property="og:url" content="https://vierradev.com/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vierra" />
        <meta
          name="twitter:description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta name="twitter:image" content="/assets/vierra-logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLoading ? (
          <div className="flex h-screen w-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8F42FF]"></div>
          </div>
        ) : (
          <>{children}</>
        )}
      </body>
    </html>
  );
}
