import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootLayoutClient from "./layout.client";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://vierradev.com";
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`;

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
    locale: "en_US",
    images: [META_IMAGE_URL],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@vierradev",
    title: "Vierra - Scale Your Practice Effortlessly",
    description: "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
    images: [META_IMAGE_URL],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        {/* Raw tags added for full OG/Twitter compatibility in production */}

        {/* Title/desc are still needed here to show in raw HTML */}
        <title>Vierra - Scale Your Practice Effortlessly</title>
        <meta name="description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <link rel="canonical" href={SITE_URL} />

        {/* Facebook / LinkedIn / OG tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta property="og:description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <meta property="og:image" content={META_IMAGE_URL} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter preview */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vierra - Scale Your Practice Effortlessly" />
        <meta name="twitter:description" content="Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services." />
        <meta name="twitter:image" content={META_IMAGE_URL} />
        <meta name="twitter:creator" content="@vierradev" />
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
