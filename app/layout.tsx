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
const LOGO_URL = `${SITE_URL}/assets/vierra-logo.png`
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vierra | Risk-Averse Lead Engine For Your Business",
    template: "Vierra | %s",
  },
  description:
    "Risk-averse, results-based B2B lead generation. Fill your sales calendar with qualified leads and eliminate risky marketing investments.",
  keywords: [
    "marketing",
    "lead generation",
    "business growth",
    "digital optimization",
    "business scaling",
    "risk-averse marketing",
    "risk-averse lead generation",
    "digital marketing agency",
    "B2B lead generation",
    "sales pipeline",
    "marketing automation",
    "business development",
  ],
  authors: [{ name: "Alex Shick", url: "https://vierradev.com" }],
  creator: "Vierra Digital",
  publisher: "Vierra Digital",
  // NOTE: `robots` is intentionally NOT set here. It lives on app/page.tsx so it
  // applies to the homepage without cascading onto the not-found boundary (which
  // Next.js auto-marks `noindex`). A layout-level `index, follow` conflicted with
  // that framework `noindex` on the 404 page.
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Vierra | Risk-Averse Lead Engine For Your Business",
    description:
      "Risk-averse, results-based B2B lead generation. Fill your sales calendar and eliminate risky marketing investments.",
    siteName: "Vierra",
    locale: "en_US",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra - Risk-Averse Lead Engine For Your Business",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@vierradev",
    site: "@vierradev",
    title: "Vierra | Risk-Averse Lead Engine For Your Business",
    description:
      "Risk-averse, results-based B2B lead generation. Fill your sales calendar and eliminate risky marketing investments.",
    images: [
      {
        url: META_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Vierra - Risk-Averse Lead Engine For Your Business",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
        {/* Google Analytics — rendered by next/script on every environment so the
            tag is part of React's tree (hydration-safe). `afterInteractive` loads
            it after hydration, non-blocking. This replaces the Netlify edge function
            that injected the snippet into <head> post-render, which caused a
            hydration mismatch (React error #418) on app-router pages. */}
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        ) : null}
        {/* SEO meta (title, description, canonical, OpenGraph, Twitter) is
            generated from the `metadata` export above — do not duplicate it here. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="alternate" type="application/rss+xml" title="Vierra Blog RSS Feed" href="https://vierradev.com/blog/rss.xml" />
        
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://vierra-server.vercel.app" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />

        <meta name="geo.region" content="US-MA" />
        <meta name="geo.placename" content="Cambridge, Massachusetts" />
        <meta name="ICBM" content="42.3736, -71.1097" />

        <script
          id="schema-org-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Vierra Digital",
              legalName: "Vierra Digital LLC",
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: LOGO_URL,
                width: 464,
                height: 188,
              },
              description: "Risk-averse, results-based B2B lead generation that fills your sales calendar with qualified leads and eliminates risky marketing investments.",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Cambridge",
                addressRegion: "MA",
                postalCode: "02138",
                addressCountry: "US",
              },
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+1-339-333-0929",
                contactType: "sales",
                email: "alex@vierradev.com",
                areaServed: "US",
                availableLanguage: "English",
              },
              sameAs: [
                "https://www.linkedin.com/company/vierra/",
                "https://www.instagram.com/vierra.dev",
                "https://www.facebook.com/share/1GXE6s4NSX/",
                "https://x.com/vierradev",
              ],
              foundingDate: "2019",
              numberOfEmployees: {
                "@type": "QuantitativeValue",
                minValue: 5,
                maxValue: 10,
              },
              location: [
                {
                  "@type": "Place",
                  name: "Vierra Digital (Cambridge HQ)",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Cambridge",
                    addressRegion: "MA",
                    postalCode: "02138",
                    addressCountry: "US",
                  },
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: 42.3736,
                    longitude: -71.1097,
                  },
                },
                {
                  "@type": "Place",
                  name: "Vierra Digital (New York)",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "New York",
                    addressRegion: "NY",
                    addressCountry: "US",
                  },
                },
              ],
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Vierra Services",
                itemListElement: [
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "B2B Lead Generation" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Risk-Averse, Results-Based Lead Generation" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Marketing Automation" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Sales Pipeline Optimization" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Ad Campaign Optimization" } },
                  { "@type": "Offer", itemOffered: { "@type": "Service", name: "Appointment Setting" } },
                ],
              },
            }),
          }}
        />
        <script
          id="schema-org-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: "Vierra",
              url: SITE_URL,
              description: "Risk-Averse Lead Engine For Your Business",
              publisher: { "@id": `${SITE_URL}/#organization` },
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
        <script
          id="schema-org-localbusiness"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": ["ProfessionalService", "LocalBusiness"],
              "@id": `${SITE_URL}/#localbusiness`,
              name: "Vierra Digital",
              legalName: "Vierra Digital LLC",
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: LOGO_URL,
                width: 464,
                height: 188,
              },
              image: META_IMAGE_URL,
              description:
                "B2B digital marketing and lead generation agency headquartered in Cambridge, MA with an office in New York, NY. Risk-averse, results-based lead generation for scaling businesses.",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Cambridge",
                addressRegion: "MA",
                postalCode: "02138",
                addressCountry: "US",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 42.3736,
                longitude: -71.1097,
              },
              telephone: "+1-339-333-0929",
              email: "alex@vierradev.com",
              priceRange: "$$$",
              founder: {
                "@type": "Person",
                name: "Alex Shick",
              },
              foundingDate: "2019",
              areaServed: [
                { "@type": "City", name: "Cambridge" },
                { "@type": "City", name: "New York" },
                { "@type": "Country", name: "United States" },
              ],
              openingHoursSpecification: {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                ],
                opens: "09:00",
                closes: "17:00",
              },
              sameAs: [
                "https://www.linkedin.com/company/vierra/",
                "https://www.instagram.com/vierra.dev",
                "https://www.facebook.com/share/1GXE6s4NSX/",
                "https://x.com/vierradev",
              ],
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
