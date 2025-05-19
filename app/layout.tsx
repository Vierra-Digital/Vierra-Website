import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import AnalyticsWrapper from "./AnalyticsWrapper"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Vierra - Scale Your Practice Effortlessly", // Updated to be more specific
  description:
    "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.", // More detailed description
  keywords: [
    "marketing",
    "lead generation",
    "business growth",
    "digital optimization",
    "practice scaling",
  ],
  authors: [{ name: "Alex Shick" }], // Using 'authors' which is an array
  openGraph: {
    title: "Vierra - Effortless Practice Scaling",
    description: "Fill your schedules and eliminate no-shows with Vierra.",
    url: "https://vierradev.com",
    siteName: "Vierra",
    images: [
      {
        url: "https://vierradev.com/assets/vierra-logo.png", // Assuming logo is in public/assets
        width: 800, // Adjust width as needed
        height: 600, // Adjust height as needed
        alt: "Vierra Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vierra - Effortless Practice Scaling",
    description: "Fill your schedules and eliminate no-shows with Vierra.",
    images: ["https://vierradev.com/assets/vierra-logo.png"], // Assuming logo is in public/assets
    // creator: '@yourTwitterHandle', // Optional: Your Twitter handle
  },
  icons: {
    // Optional: Favicon and apple touch icons
    icon: "/favicon.ico", // Make sure favicon.ico exists in /public
    apple: "/apple-touch-icon.png", // Make sure apple-touch-icon.png exists in /public
  },
  // manifest: '/site.webmanifest', // Optional: If you have a web app manifest
  // other: { // For custom meta tags not directly supported
  //   keywords: "marketing, lead generation, business growth, digital optimization", // Alternative way if 'keywords' array isn't preferred
  //   author: "Alex Shick", // Alternative way if 'authors' array isn't preferred
  // }
}

export const viewport: Viewport = {
  themeColor: "#8F42FF", // Added theme color
  // You can add other viewport-related settings here:
  // width: 'device-width',
  // initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Client-side hooks (useState, useEffect) and related logic (isLoading, validateAnalytics)
  // have been moved to AnalyticsWrapper.tsx

  // Organization Schema for SEO (from previous steps)
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vierra Development",
    url: "https://vierradev.com",
    logo: "https://vierradev.com/assets/meta-banner.png", // Or vierra-logo.png
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-781-496-8867", // Ensure this is your correct phone number
      contactType: "Sales", // Or "Customer Service" etc.
    },
    sameAs: [
      "https://www.linkedin.com/company/vierra/", // Ensure this is your correct LinkedIn
      // Add other social media links if applicable
    ],
  }

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        {/* Script for Organization Schema */}
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
        <AnalyticsWrapper>{children}</AnalyticsWrapper>
      </body>
    </html>
  )
}
