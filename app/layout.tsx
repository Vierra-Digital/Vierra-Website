import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootLayoutClient from "./layout.client";
import Script from "next/script";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://vierradev.com";
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`;

/**
 * Next.js will still generate its own <meta> tags from this object.
 * The additional static tags in <head> below act as a guarantee for
 * social crawlers that occasionally miss dynamically-generated tags
 * in certain Netlify production setups.
 */
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Vierra - Scale Your Practice Effortlessly",
  description:
    "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
  keywords: ["marketing", "lead generation", "business growth", "digital optimization", "practice scaling"],
  authors: [{ name: "Alex Shick" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Vierra - Scale Your Practice Effortlessly",
    description:
      "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
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
    title: "Vierra - Scale Your Practice Effortlessly",
    description:
      "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
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
    apple: "/apple-touch-icon.png",
  },
  alternates: { canonical: SITE_URL },
};

export const viewport = {
  themeColor: "#8F42FF",
  scrollBehavior: "smooth",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        {/* Static fallbacks for OG/Twitter scrapers that sometimes skip dynamically-generated tags */}
        <meta charSet="utf-8" />
        <meta
          name="description"
          content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services."
          key="meta-description"
        />
        <meta name="keywords" content="marketing, lead generation, business growth, digital optimization, practice scaling" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta
          property="og:description"
          content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services."
        />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:site_name" content="Vierra" />
        <meta property="og:image" content={META_IMAGE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:creator" content="@vierradev" />
        <meta name="twitter:site" content="@vierradev" />
        <meta name="twitter:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta
          name="twitter:description"
          content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services."
        />
        <meta name="twitter:image" content={META_IMAGE_URL} />
        <link rel="canonical" href={SITE_URL} />

        {/* JSON-LD for rich results */}
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
        <RootLayoutClient geistSansVariable={geistSans.variable} geistMonoVariable={geistMono.variable}>
          {children}
        </RootLayoutClient>
      </body>
    </html>
  );
}
