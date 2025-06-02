import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import RootLayoutClient from "./layout.client"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Updated metadata export - themeColor removed
export const metadata = {
  metadataBase: new URL('https://vierradev.com'),
  title: "Vierra - Scale Your Practice Effortlessly",
  description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
  keywords: ["marketing", "lead generation", "business growth", "digital optimization", "practice scaling"],
  authors: [{ name: "Alex Shick" }],
  openGraph: {
    type: "website",
    url: "https://vierradev.com",
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    siteName: "Vierra",
    images: [{
      url: "https://vierradev.com/assets/meta-banner.png",
      width: 1200,
      height: 630,
      alt: "Vierra"
    }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    images: ["https://vierradev.com/assets/meta-banner.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://vierradev.com",
  }
}

// New viewport export with themeColor
export const viewport = {
  themeColor: "#8F42FF",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RootLayoutClient 
      geistSansVariable={geistSans.variable}
      geistMonoVariable={geistMono.variable}
    >
      {children}
    </RootLayoutClient>
  )
}