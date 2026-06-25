import "../app/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { SessionProvider } from "@/lib/session-client";

// GA for pages-router routes (blog, careers, legal). App-router pages get it from
// app/layout.tsx. Both use next/script so the tag is hydration-safe (no edge inject).
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Don't load analytics on private admin areas (matches the prior edge-function skip list).
const NO_ANALYTICS_PREFIXES = ["/panel", "/client"];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const analyticsEnabled =
    !!GA_MEASUREMENT_ID && !NO_ANALYTICS_PREFIXES.some((p) => router.pathname.startsWith(p));

  return (
    <SessionProvider>
      <>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="shortcut icon" href="/favicon.ico" />
        </Head>
        <Component {...pageProps} />
        {analyticsEnabled && (
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
        )}
      </>
    </SessionProvider>
  );
}