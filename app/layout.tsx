import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootLayoutClient from "./layout.client";
import Script from "next/script";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://vierradev.com";
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`;

// Next.js metadata API is now the *only* source of truth for SEO/social tags.
// This ensures SSR generates all correct <meta> tags in the final HTML.
// Don't double up with manual <meta> tags in <head> — that causes conflicts.
export const metadata = {
  metadataBase: new URL(SITE_URL),
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
        {/* JSON-LD for rich results, included manually since Next.js doesn't generate this yet */}
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

