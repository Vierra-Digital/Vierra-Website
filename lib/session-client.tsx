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
  const [state, setState] = useState<SessionContextValue>({ data: null, status: "loading" });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function resolve(hasSupabaseSession: boolean) {
      if (!hasSupabaseSession) {
        if (active) setState({ data: null, status: "unauthenticated" });
        return;
      }
      const me = await fetchMe();
      if (!active) return;
      setState(me ? { data: { user: me }, status: "authenticated" } : { data: null, status: "unauthenticated" });
    }

    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => resolve(!!data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
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
  await supabase.auth.signOut();
  if (options?.callbackUrl) {
    window.location.href = options.callbackUrl;
  }
}
