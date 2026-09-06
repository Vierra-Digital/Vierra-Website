"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The client company a Vierra staff member is currently working on (see
 * docs/ROLE_MODEL_REDESIGN.md's "v2" section, Phase 4) — since every staff member's own
 * company_memberships row now points at Vierra's fixed company, there's no longer an implicit
 * "my own company's data" to scope panel pages by. This is stored in localStorage, not
 * sessionStorage — the Email Panel (pages/panel/email) opens in its own browser tab
 * (window.open), and sessionStorage is isolated per-tab, so a sessionStorage-based selection
 * made on the main panel tab could never reach it at all. localStorage is shared across every
 * tab of the same origin, which is what "one active client for this whole login" actually needs.
 */
export type ActiveClient = { id: string; name: string };

type ActiveClientContextValue = {
  activeClient: ActiveClient | null;
  setActiveClient: (client: ActiveClient | null) => void;
};

const ActiveClientContext = createContext<ActiveClientContextValue>({
  activeClient: null,
  setActiveClient: () => {},
});

const CACHE_KEY = "vierra_active_client";

function readCache(): ActiveClient | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ActiveClient) : null;
  } catch {
    return null;
  }
}

function writeCache(client: ActiveClient | null) {
  try {
    if (client) localStorage.setItem(CACHE_KEY, JSON.stringify(client));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const [activeClient, setActiveClientState] = useState<ActiveClient | null>(null);

  useEffect(() => {
    // Seeded from localStorage after mount, not as initial state — localStorage doesn't exist
    // during the server render, so reading it there would make server/client markup disagree
    // (same reasoning as lib/session-client.tsx's own cached-session seed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveClientState(readCache());

    // Picking up a change made in another tab (e.g. selected on the main panel, this tab is the
    // already-open Email Panel) — the storage event only fires in tabs OTHER than the one that
    // wrote it, which is exactly the cross-tab case this exists for.
    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_KEY) setActiveClientState(readCache());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setActiveClient = (client: ActiveClient | null) => {
    writeCache(client);
    setActiveClientState(client);
  };

  return (
    <ActiveClientContext.Provider value={{ activeClient, setActiveClient }}>
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  return useContext(ActiveClientContext);
}
