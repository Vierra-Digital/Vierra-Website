import { useEffect, useState } from "react";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import { subscribeToDiscardConfirm, type DiscardConfirmRequest } from "@/lib/panel/drafts";

/**
 * Single shared instance (mounted once in pages/_app.tsx) backing every confirmDiscardDrafts()
 * call across the panel and email settings — replaces the native window.confirm those used to
 * show, so leaving a dirty form always renders the same in-app dialog instead of browser chrome.
 */
export default function DiscardChangesModal() {
  const [request, setRequest] = useState<DiscardConfirmRequest | null>(null);

  useEffect(() => subscribeToDiscardConfirm(setRequest), []);

  return (
    <ConfirmActionModal
      isOpen={Boolean(request)}
      title="Leave without saving?"
      message={request?.message || ""}
      confirmLabel="Leave without saving"
      cancelLabel="Stay"
      danger={false}
      onCancel={() => request?.resolve(false)}
      onConfirm={() => request?.resolve(true)}
    />
  );
}
