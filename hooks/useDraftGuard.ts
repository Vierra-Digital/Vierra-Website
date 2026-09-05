import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { confirmDiscardDrafts, draftState, registerDraft } from "@/lib/panel/drafts";

/** In-memory only: draft content is never written to browser storage. */
export function useDraftGuard(dirty: boolean, label: string, scope: string, busy = false) {
  const key = useRef(Symbol(label));
  useEffect(() => {
    if (!dirty && !busy) return;
    return registerDraft(key.current, { label, scope, busy });
  }, [dirty, label, scope, busy]);
  return () => confirmDiscardDrafts(scope);
}

export function usePageLeaveGuard() {
  const router = useRouter();
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeRoute = (url: string) => {
      const next = new URL(url, window.location.origin);
      const current = new URL(window.location.href);
      // Search/filter changes do not unmount an editor. Entity/account changes do.
      const keys = ["section", "client", "view", "settings", "accounts", "module", "board", "task"];
      if (next.pathname === current.pathname && keys.every(key => next.searchParams.get(key) === current.searchParams.get(key))) return;
      if (!draftState().dirty) return;
      // The modal's answer is async, but a routeChangeStart listener must decide synchronously —
      // cancel this attempt now (Next.js has no way to "pause" an in-flight transition) and, if
      // the user then confirms discarding in the modal, re-issue the same navigation ourselves.
      const error = Object.assign(new Error("Navigation canceled to preserve unsaved changes"), { cancelled: true });
      router.events.emit("routeChangeError", error, url, { shallow: false });
      // Opening the modal is deferred a tick: Next's dev-mode overlay treats this throw as an
      // uncaught exception (even tagged `cancelled: true`) and recovers via a remount, which — if
      // the confirm request were raised synchronously alongside the throw, in the same tick —
      // tore it down before DiscardChangesModal ever painted it.
      setTimeout(() => {
        // confirmDiscardDrafts() actually clears the matching drafts on a "yes" (see
        // lib/panel/drafts.ts), so this retried push's own beforeRoute call sees draftState() as
        // no longer dirty and lets it straight through — no separate bypass flag needed.
        void confirmDiscardDrafts().then((confirmed) => {
          if (confirmed) void router.push(url);
        });
      }, 0);
      throw error;
    };
    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", beforeRoute);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", beforeRoute);
    };
  }, [router]);
}
