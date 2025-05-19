import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import type { Metadata } from "next"
import AnalyticsWrapper from "./AnalyticsWrapper"; // Import the new wrapper

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
  themeColor: "#8F42FF",
  openGraph: {
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    url: "https://vierradev.com",
    siteName: "Vierra",
    images: [
      {
        url: "https://vierradev.com/assets/meta-banner.png",
        width: 1200,
        height: 630,
        alt: "Vierra - Scale Your Practice Effortlessly",
      },
    ],
    locale: "en_US",
    type: "website",
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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Vierra Development",
    "url": "https://vierradev.com",
    "logo": "https://vierradev.com/assets/meta-banner.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-781-496-8867",
      "contactType": "Sales",
    },
    "sameAs": [
      "https://www.linkedin.com/company/vierra/"
    ]
  }

  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
