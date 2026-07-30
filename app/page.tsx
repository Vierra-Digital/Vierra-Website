import type { Metadata } from "next"
import HomeClient from "./home-client"

// The homepage owns its own robots policy so it isn't inherited by the
// app-router not-found boundary (app/not-found.tsx), which Next.js auto-marks
// `noindex`. Keeping robots in the root layout previously emitted BOTH a
// framework `noindex` and this `index, follow` on the 404 page — a conflicting
// pair. This is a Server Component (no "use client") so it can export metadata;
// the interactive UI lives in ./home-client.
export const metadata: Metadata = {
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
}

export default function Page() {
  return <HomeClient />
}
