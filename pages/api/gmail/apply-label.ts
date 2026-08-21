import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { asStr } from "@/lib/api/parsing";
import { invalidateGmailListCache } from "@/lib/gmail/messageListCache";
import { invalidateGmailCountsCache } from "@/lib/gmail/countsCache";

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const messageId = asStr(req.body?.messageId).trim();
    const requestedLabelId = asStr(req.body?.labelId).trim();
    // Gmail label ids are per-account, so a id resolved against the primary mailbox is
    // meaningless in a second one. Callers therefore also send the label NAME, and we resolve
    // (or create) the matching label inside whichever account this message actually lives in.
    const labelName = asStr(req.body?.labelName).trim();
    const remove = Boolean(req.body?.remove);
    if (!accountEmail || !messageId || (!requestedLabelId && !labelName)) {
      res.status(400).json({ message: "accountEmail, messageId, and labelId or labelName are required." });
      return;
    }
    // Own mailbox, or a shared inbox granted WITH send permission (read-only grants can't modify).
    const access = await resolveMailboxOwner(userId, accountEmail);
    if (!access || !access.canSend) {
      res.status(403).json({ message: "You don't have permission to act on this mailbox." });
      return;
    }
    const token = await getValidGmailAccessToken(access.ownerUserId, access.tokenEmail);
    if (!token.ok) {
      res.status(400).json({ message: token.message });
      return;
    }
    // Resolve the label id to use in THIS account: trust the caller's id only when it really
    // exists here, otherwise match by name (creating it when applying, never when removing).
    let labelId = requestedLabelId;
    if (labelName) {
      const listResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      const listPayload = listResponse.ok ? await listResponse.json().catch(() => null) : null;
      const existing: Array<{ id?: string; name?: string }> = Array.isArray(listPayload?.labels)
        ? listPayload.labels
        : [];
      const idExistsHere = requestedLabelId && existing.some((label) => label.id === requestedLabelId);
      if (!idExistsHere) {
        const byName = existing.find(
          (label) => (label.name || "").toLowerCase() === labelName.toLowerCase()
        );
        if (byName?.id) {
          labelId = byName.id;
        } else if (!remove) {
          const created = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
            method: "POST",
            headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: labelName,
              labelListVisibility: "labelShow",
              messageListVisibility: "show",
            }),
          });
          const createdPayload = created.ok ? await created.json().catch(() => null) : null;
          if (!createdPayload?.id) {
            res.status(502).json({ message: "Could not create the label in this mailbox." });
            return;
          }
          labelId = createdPayload.id;
        }
      }
    }
    if (!labelId) {
      res.status(400).json({ message: "Label not found in this mailbox." });
      return;
    }

    const body = remove ? { removeLabelIds: [labelId] } : { addLabelIds: [labelId] };
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ message: text || "Failed to update label." });
      return;
    }
    invalidateGmailListCache(access.ownerUserId, access.tokenEmail);
    invalidateGmailCountsCache(access.ownerUserId, access.tokenEmail);
    res.status(200).json({ ok: true });
  },
  { methods: ["POST"] }
);
