import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import RootLayoutClient from "./layout.client"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Fix: Use absolute URL with explicit domain to ensure crawlers can access the image
const SITE_URL = 'https://vierradev.com';
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`;

// Updated metadata export with explicit image handling
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Vierra - Scale Your Practice Effortlessly",
  description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
  keywords: ["marketing", "lead generation", "business growth", "digital optimization", "practice scaling"],
  authors: [{ name: "Alex Shick" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    siteName: "Vierra",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra",
        type: "image/png",  
        secureUrl: META_IMAGE_URL
      }
    ],
    locale: "en_US",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    creator: "@vierradev",
    images: [
      {
        url: META_IMAGE_URL,
        alt: "Vierra",
        width: 1200,
        height: 630,
      }
    ],
  },
  
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: SITE_URL,
  },
}

// New viewport export with themeColor
export const viewport = {
  themeColor: "#8F42FF",
  scrollBehavior: "smooth"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <meta property="og:image" content={META_IMAGE_URL} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
      </head>
      <body>
        <RootLayoutClient
          geistSansVariable={geistSans.variable}
          geistMonoVariable={geistMono.variable}
        >
          {children}
        </RootLayoutClient>
      </body>
    </html>
  );
}