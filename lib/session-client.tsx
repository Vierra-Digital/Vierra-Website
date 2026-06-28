"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionUser = {
  id: string;
  email?: string | null;
  role?: string;
  name?: string;
  kind?: "member" | "client" | "unaffiliated";
  companyId?: string;
  clientId?: string;
};
type Session = { user: SessionUser } | null;
type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = { data: Session; status: SessionStatus };

const SessionContext = createContext<SessionContextValue>({ data: null, status: "loading" });

const CACHE_KEY = "vierra_session";

function readCache(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeCache(user: SessionUser | null) {
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Start as "loading" so SSR and client initial render match (no hydration mismatch).
  const [state, setState] = useState<SessionContextValue>({ data: null, status: "loading" });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    // Show cached session immediately — eliminates loading flash on navigation/refresh.
    const cached = readCache();
    if (cached) setState({ data: { user: cached }, status: "authenticated" });

    async function resolve(hasSupabaseSession: boolean) {
      if (!hasSupabaseSession) {
        writeCache(null);
        if (active) setState({ data: null, status: "unauthenticated" });
        return;
      }
      const me = await fetchMe();
      if (!active) return;
      writeCache(me);
      setState(me ? { data: { user: me }, status: "authenticated" } : { data: null, status: "unauthenticated" });
    }

    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => resolve(!!data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      // Token refreshes don't change user data — skip the round-trip.
      if (event === "TOKEN_REFRESHED") return;
      resolve(!!session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signOut(options?: { callbackUrl?: string }) {
  const supabase = getSupabaseBrowserClient();
  writeCache(null);
  await supabase.auth.signOut();
  if (options?.callbackUrl) {
    window.location.href = options.callbackUrl;
  }
}
