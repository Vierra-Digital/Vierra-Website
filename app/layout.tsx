import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootLayoutClient from "./layout.client";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// absolute base so every OG/Twitter asset resolves in prod
const SITE_URL = "https://vierradev.com";
const META_IMAGE_URL = `${SITE_URL}/assets/meta-banner.png`;

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
    images: [META_IMAGE_URL], 
  },
  twitter: {
    card: "summary_large_image",
    creator: "@vierradev",
    title: "Vierra - Scale Your Practice Effortlessly",
    description:
      "Scale your practice effortlessly with Vierra. Fill your schedules and eliminate no-shows with our expert marketing and lead generation services.",
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
