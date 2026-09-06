import { flushSync } from "react-dom";

type Draft = { scope: string; label: string; busy: boolean };
const drafts = new Map<symbol, Draft>();

export function registerDraft(key: symbol, draft: Draft) {
  drafts.set(key, draft);
  return () => { drafts.delete(key); };
}

export function draftState(scope?: string) {
  const matching = [...drafts.values()].filter(draft => !scope || draft.scope === scope);
  return { dirty: matching.length > 0, busy: matching.some(draft => draft.busy), labels: [...new Set(matching.map(draft => draft.label))] };
}

export type DiscardConfirmRequest = { message: string; resolve: (result: boolean) => void };

// Module-level pub-sub instead of React context: registerDraft()/confirmDiscardDrafts() are
// called from many independent components with no shared provider between them (this file is
// also imported by pages/panel.tsx directly, outside any component tree). One listener — see
// DiscardChangesModal, mounted once in pages/_app.tsx — renders whatever request is active.
let activeRequest: DiscardConfirmRequest | null = null;
const listeners = new Set<(request: DiscardConfirmRequest | null) => void>();

export function subscribeToDiscardConfirm(listener: (request: DiscardConfirmRequest | null) => void) {
  listeners.add(listener);
  listener(activeRequest);
  return () => { listeners.delete(listener); };
}

function notify() {
  // Synchronous, not just scheduled: usePageLeaveGuard's beforeRoute calls confirmDiscardDrafts()
  // and then immediately throws (Next's Pages Router only treats a routeChangeStart listener as
  // cancelling navigation if it throws synchronously — see hooks/useDraftGuard.ts). Without
  // flushSync, the modal's state update was still pending when that throw interrupted the tick,
  // so DiscardChangesModal never actually painted before the exception propagated.
  flushSync(() => {
    listeners.forEach(listener => listener(activeRequest));
  });
}

/**
 * Confirms discarding unsaved drafts (optionally scoped) via the shared modal (DiscardChangesModal)
 * — never a native window.confirm, so it renders consistently instead of the browser's own dialog
 * chrome. Resolves true immediately when nothing is dirty.
 *
 * A save in flight can't be safely discarded (the write could still land after leaving), so that
 * case blocks with an informational alert rather than offering a choice — window.alert here is
 * fine, it's not asking the user to decide anything, just to wait.
 */
export function confirmDiscardDrafts(scope?: string): Promise<boolean> {
  const state = draftState(scope);
  if (!state.dirty) return Promise.resolve(true);
  if (state.busy) {
    if (typeof window !== "undefined") {
      window.alert("A save is still in progress. Wait for it to finish before leaving or refreshing.");
    }
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    activeRequest = {
      message: `Unsaved changes in ${state.labels.join(", ")}. Leave and discard these changes?`,
      resolve: (result) => {
        activeRequest = null;
        if (result) {
          // Actually discard, not just answer "yes": a caller that retries its action right after
          // (usePageLeaveGuard re-issuing the navigation it had to cancel to show this prompt)
          // must see draftState().dirty as false immediately, or it re-asks forever — the dirty
          // component itself may still be mounted for a few more ticks (unmounting is what
          // normally clears its registration), so this can't wait for that.
          for (const [key, draft] of drafts) {
            if (!scope || draft.scope === scope) drafts.delete(key);
          }
        }
        notify();
        resolve(result);
      },
    };
    notify();
  });
}
