/*
 * © 2025 Darsh Doshi. All rights reserved.
 * Unauthorized use, modification, or distribution of this code is strictly prohibited.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vierra",
  description:
    "Scale your practice effortlessly. Fill out your schedules and eliminate no-shows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta
          name="keywords"
          content="marketing, lead generation, business growth, digital optimization"
        />
        <meta name="author" content="Darsh Doshi" />

        {/* Open Graph (OG) Meta Tags for Social Sharing */}
        <meta property="og:title" content="Vierra" />
        <meta
          property="og:description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta property="og:image" content="/assets/vierra-logo.png" />
        <meta property="og:url" content="https://vierradev.com/" />
        <meta property="og:type" content="website" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vierra" />
        <meta
          name="twitter:description"
          content="Scale your practice effortlessly. Fill out your schedules and eliminate no-shows."
        />
        <meta name="twitter:image" content="/assets/vierra-logo.png" />

        <title>Vierra</title>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
