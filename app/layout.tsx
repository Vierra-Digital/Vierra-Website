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
  title: "Vierra - Scale Your Practice Effortlessly",
  description:
    "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
  keywords: [
    "marketing",
    "lead generation",
    "business growth",
    "digital optimization",
    "practice scaling",
  ],
  authors: [{ name: "Alex Shick" }],
  alternates: {
    canonical: "https://vierradev.com",
  },
  themeColor: "#8F42FF", // Added theme color
  openGraph: {
    title: "Vierra - Effortless Practice Scaling",
    description: "Fill your schedules and eliminate no-shows with Vierra.",
    url: "https://vierradev.com",
    siteName: "Vierra",
    images: [
      {
        url: "https://vierradev.com/assets/meta-banner.png", // Updated image
        width: 1200, // Adjust if your banner has different dimensions
        height: 630, // Adjust if your banner has different dimensions
        alt: "Vierra - Scale Your Practice Effortlessly",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vierra - Effortless Practice Scaling",
    description: "Fill your schedules and eliminate no-shows with Vierra.",
    images: ["https://vierradev.com/assets/meta-banner.png"], // Updated image
    // creator: '@yourTwitterHandle',
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  // manifest: '/site.webmanifest',
};

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

  // Define Organization Schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Vierra Development",
    "url": "https://vierradev.com",
    "logo": "https://vierradev.com/assets/meta-banner.png", 
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-781-496-8867", 
      "contactType": "Customer Service" 
    },
    "sameAs": [ 
      "https://www.instagram.com/yourprofile", // Replace with your actual Instagram link
      "https://www.linkedin.com/company/yourcompany", // Replace with your actual LinkedIn link
      "https://twitter.com/yourprofile" // Replace with your actual Twitter/X link
      // Add other social media links if you have them, e.g., Facebook, YouTube
    ]
  };

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        {/* Next.js will inject metadata here */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
