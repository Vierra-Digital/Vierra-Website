import localFont from "next/font/local";

// Self-hosted fonts (previously next/font/google). The .woff2 files are committed
// under public/fonts, so production builds never depend on a build-time network
// fetch to Google Fonts. These are the latin-subset variable fonts, matching the
// prior `Font({ subsets: ["latin"] })` usage. Import these instead of calling the
// google loaders per-file.

export const inter = localFont({
  src: "../public/fonts/Inter-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

export const bricolage = localFont({
  src: "../public/fonts/BricolageGrotesque-latin.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-bricolage",
});

export const figtree = localFont({
  src: "../public/fonts/Figtree-latin.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-figtree",
});
