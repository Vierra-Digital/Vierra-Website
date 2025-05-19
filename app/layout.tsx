"use client"; // Added: This file is now a Client Component
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import {
  initializeAnalytics,
  storeAnalyticsData,
  checkAnalyticsStatus,
} from "@/lib/analytics"
import { useEffect, useState } from "react"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [isLoading, setIsLoading] = useState(true)

  const validateAnalytics = async () => {
    setIsLoading(true)
    if (checkAnalyticsStatus()) {
      setIsLoading(false)
      return
    }
    const result = await initializeAnalytics()
    storeAnalyticsData(result)
    setIsLoading(false)
  }

  useEffect(() => {
    validateAnalytics()
    const intervalId = setInterval(validateAnalytics, 3600000)
    return () => clearInterval(intervalId)
  }, [])

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vierra Development",
    url: "https://vierradev.com",
    logo: "https://vierradev.com/assets/meta-banner.png",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-781-496-8867",
      contactType: "Sales",
    },
    sameAs: [
      "https://www.linkedin.com/company/vierra/",
    ],
  }

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <meta charSet="UTF-8" />
        <title>Vierra - Scale Your Practice Effortlessly</title>
        <meta name="description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <meta name="keywords" content="marketing, lead generation, business growth, digital optimization, practice scaling" />
        <meta name="author" content="Alex Shick" />
        <link rel="canonical" href="https://vierradev.com" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://vierradev.com" />
        <meta property="og:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta property="og:description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Vierra" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta name="twitter:description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />

        {/* Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Viewport and Theme */}
        <meta name="viewport" content="width=device-width, initial-scale=1" /> 
        <meta name="theme-color" content="#8F42FF" />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
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
  )
}
