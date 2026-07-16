import { Html, Head, Main, NextScript } from "next/document";

// Custom Document so Pages Router routes (/blog, /faq, /careers, legal pages)
// render <html lang="en"> — the App Router sets this in app/layout.tsx, but
// Pages Router needs it declared here or the lang attribute is missing.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
