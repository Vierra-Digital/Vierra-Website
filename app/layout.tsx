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
  title: {
    default: "Vierra | Risk-Averse Guaranteed Leads For Your Business",
    template: "Vierra | %s",
  },
  description:
    "Scale your business effortlessly with guaranteed leads. Fill in your sales calendar and eliminate risky marketing investments. Professional digital marketing and lead generation services.",
  keywords: [
    "marketing",
    "lead generation",
    "business growth",
    "digital optimization",
    "business scaling",
    "risk-averse marketing",
    "guaranteed leads",
    "digital marketing agency",
    "B2B lead generation",
    "sales pipeline",
    "marketing automation",
    "business development",
  ],
  authors: [{ name: "Alex Shick", url: "https://vierradev.com" }],
  creator: "Vierra Digital",
  publisher: "Vierra Digital",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Vierra | Risk-Averse Guaranteed Leads For Your Business",
    description:
      "Scale your business effortlessly with guaranteed leads. Fill in your sales calendar and eliminate risky marketing investments.",
    siteName: "Vierra",
    locale: "en_US",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra - Risk-Averse Guaranteed Leads For Your Business",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@vierradev",
    site: "@vierradev",
    title: "Vierra | Risk-Averse Guaranteed Leads For Your Business",
    description:
      "Scale your business effortlessly with guaranteed leads. Fill in your sales calendar and eliminate risky marketing investments.",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra - Risk-Averse Guaranteed Leads For Your Business",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION || undefined,
  },
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
        <link rel="manifest" href="/manifest.json" />
        
        {/* Preconnect to external origins for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://vierra-server.vercel.app" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />

        <Script
          id="schema-org-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Vierra Digital",
              legalName: "Vierra Digital LLC",
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: META_IMAGE_URL,
                width: 1200,
                height: 630,
              },
              description: "Scale your business effortlessly with guaranteed leads. Fill in your sales calendar and eliminate risky marketing investments.",
              address: {
                "@type": "PostalAddress",
                addressCountry: "US",
              },
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+1-781-496-8867",
                contactType: "Sales",
                email: "alex@vierradev.com",
                areaServed: "US",
                availableLanguage: "English",
              },
              sameAs: [
                "https://www.linkedin.com/company/vierra/",
                "https://www.instagram.com/vierra.dev",
                "https://www.facebook.com/share/1GXE6s4NSX/",
              ],
              foundingDate: "2024",
              numberOfEmployees: {
                "@type": "QuantitativeValue",
                value: "10-50",
              },
            }),
          }}
        />
        <Script
          id="schema-org-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Vierra",
              url: SITE_URL,
              description: "Risk-Averse Guaranteed Leads For Your Business",
              publisher: {
                "@type": "Organization",
                name: "Vierra Digital",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/blog?search={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
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
