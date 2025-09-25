import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import RootLayoutClient from "./layout.client"
import Script from "next/script"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const SITE_URL = "https://vierradev.com"
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Vierra",
  description:
    "Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments.",
  keywords: [
    "marketing",
    "lead generation",
    "business growth",
    "digital optimization",
    "business scaling",
    "risk-averse marketing",
  ],
  authors: [{ name: "Alex Shick" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Vierra",
    description:
      "Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments.",
    siteName: "Vierra",
    locale: "en_US",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@vierradev",
    site: "@vierradev",
    title: "Vierra",
    description:
      "Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments.",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
  },
  alternates: { canonical: SITE_URL },
}

export const viewport = {
  themeColor: "#8F42FF",
  scrollBehavior: "smooth",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="description"
          content="Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments."
          key="meta-description"
        />
        <meta
          name="keywords"
          content="marketing, lead generation, business growth, digital optimization, business scaling, risk-averse marketing"
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Vierra" />
        <meta
          property="og:description"
          content="Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments."
        />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="Vierra" />
        <meta property="og:image" content={META_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@vierradev" />
        <meta name="twitter:site" content="@vierradev" />
        <meta name="twitter:title" content="Vierra" />
        <meta
          name="twitter:description"
          content="Scale your business effortlessly. Fill in your sales calendar and eliminate risky marketing investments."
        />
        <meta name="twitter:image" content={META_IMAGE_URL} />
        <link rel="canonical" href={SITE_URL} />

        <Script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Vierra Development",
              url: SITE_URL,
              logo: META_IMAGE_URL,
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+1-781-496-8867",
                contactType: "Sales",
              },
              sameAs: ["https://www.linkedin.com/company/vierra/"],
            }),
          }}
        />
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
  )
}
