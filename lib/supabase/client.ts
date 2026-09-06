"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Default is true, which makes this shared client silently adopt any
          // access_token/refresh_token left in the URL hash on ANY page — including one a
          // recovery/invite redirect chain lands someone on after already being logged in
          // elsewhere (e.g. an admin's session got hijacked by a client's invite tokens after
          // getServerSideProps redirected /onboarding/accept-invite -> /panel with the hash
          // still attached). /set-password and /onboarding/start are the only two pages that
          // should ever act on those tokens, and both do so explicitly via setSession() now —
          // so no page should be relying on this implicit behavior.
          detectSessionInUrl: false,
        },
      }
    );
  }
  return client;
}
