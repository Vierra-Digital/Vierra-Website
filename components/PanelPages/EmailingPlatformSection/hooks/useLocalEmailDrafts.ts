import { useCallback, useRef, useState } from "react";
import type { LocalEmailDraft } from "@/components/email/types";

/**
 * Server-persisted "local" draft autosave — a draft key maps to a row in `/api/gmail/drafts`, kept
 * fresh by a debounced save while composing and flushed synchronously on close/unload. Shared by
 * the full compose modal and inline reply (see useComposeWindow), which use disjoint key
 * namespaces (`popup:*` vs `inline:*`) so one queue instance is safe for both.
 */
export function useLocalEmailDrafts() {
  const draftSaveQueue = useRef(new Map<string, Promise<boolean>>());
  const [draftSaveState, setDraftSaveState] = useState("");

  const saveLocalDraft = useCallback(async (key: string, draft: LocalEmailDraft, options?: { keepalive?: boolean }) => {
    if (!key) return false;
    const previous = draftSaveQueue.current.get(key);
    const operation = (async () => {
      if (previous) await previous;
      setDraftSaveState("Saving draft...");
      const response = await fetch("/api/gmail/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: Boolean(options?.keepalive),
        body: JSON.stringify({
          draftKey: key,
          accountEmail: draft.accountEmail || null,
          to: draft.to,
          cc: draft.cc || "",
          bcc: draft.bcc || "",
          showCc: Boolean(draft.showCc),
          showBcc: Boolean(draft.showBcc),
          subject: draft.subject || "",
          bodyText: draft.bodyText || "",
          bodyHtml: draft.bodyHtml || "",
          previewHtml: draft.previewHtml || "",
          threadId: draft.threadId || "",
          inReplyTo: draft.inReplyTo || "",
          references: draft.references || "",
        }),
      }).catch(() => null);
      setDraftSaveState(response?.ok ? "Draft saved" : "Could not save draft. Keep this page open and retry.");
      return Boolean(response?.ok);
    })();
    draftSaveQueue.current.set(key, operation);
    const success = await operation;
    if (draftSaveQueue.current.get(key) === operation) draftSaveQueue.current.delete(key);
    return success;
  }, []);

  const clearLocalDraft = useCallback(async (key: string, options?: { keepalive?: boolean }) => {
    if (!key) return;
    const response = await fetch("/api/gmail/drafts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      keepalive: Boolean(options?.keepalive),
      body: JSON.stringify({ draftKey: key }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || "Failed to clear draft.");
    }
  }, []);

  return { saveLocalDraft, clearLocalDraft, draftSaveState };
}
