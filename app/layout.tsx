"use client"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import {
  initializeAnalytics,
  storeAnalyticsData,
  checkAnalyticsStatus,
} from "@/lib/analytics"
import { useEffect, useState } from "react"
import type { Metadata } from "next"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Vierra Development - Custom Web Solutions", // Replace with your main site title
  description:
    "Vierra Development offers bespoke web development, design, and SEO services to elevate your online presence.", // Replace with your site description
  openGraph: {
    title: "Vierra Development - Custom Web Solutions", // OG title
    description: "Bespoke web solutions to grow your business.", // OG description
    url: "https://vierradev.com", // Your site URL
    siteName: "Vierra Development",
    // images: [ // Optional: Add Open Graph images
    //   {
    //     url: 'https://vierradev.com/og-image.png', // URL to your OG image
    //     width: 1200,
    //     height: 630,
    //   },
    // ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    // Optional: Twitter specific card
    card: "summary_large_image",
    title: "Vierra Development - Custom Web Solutions",
    description: "Bespoke web solutions to grow your business.",
    // images: ['https://vierradev.com/twitter-image.png'], // URL to your Twitter image
    // creator: '@yourTwitterHandle', // Optional: Your Twitter handle
  },
  // icons: { // Optional: Favicon and apple touch icons
  //   icon: '/favicon.ico',
  //   apple: '/apple-touch-icon.png',
  // },
  // manifest: '/site.webmanifest', // Optional: If you have a web app manifest
}

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
        <meta name="author" content="Alex Shick" />
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
  )
}