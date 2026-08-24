import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { asStr } from "@/lib/api/parsing";
import { invalidateGmailListCache } from "@/lib/gmail/messageListCache";
import { invalidateGmailCountsCache } from "@/lib/gmail/countsCache";
import { mapInBatches } from "@/lib/batch";
import {
  fetchWithTimeout,
  GMAIL_BATCH_CONCURRENCY,
  GMAIL_RATE_LIMIT_RETRIES,
  isRateLimited,
  backoffDelayMs,
  delay,
} from "@/lib/gmail/rateLimitedFetch";

type LabelItem = { accountEmail: string; messageId: string };

function normalizeItems(input: unknown): LabelItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      accountEmail: asStr((item as any)?.accountEmail).trim().toLowerCase(),
      messageId: asStr((item as any)?.messageId).trim(),
    }))
    .filter((item) => item.accountEmail && item.messageId);
}

/**
 * Resolve (or create) the label id to use for `labelName`/`requestedLabelId` inside `accountEmail`.
 * Gmail label ids are per-account, so an id resolved against one mailbox is meaningless in
 * another — the caller sends the name too, and this matches (or creates) it in whichever
 * account the message actually lives in. One list/create call per account, not per message.
 */
async function resolveLabelId(
  accessToken: string,
  requestedLabelId: string,
  labelName: string,
  remove: boolean
): Promise<string | null> {
  if (!labelName) return requestedLabelId || null;
  const listResponse = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listPayload = listResponse.ok ? await listResponse.json().catch(() => null) : null;
  const existing: Array<{ id?: string; name?: string }> = Array.isArray(listPayload?.labels) ? listPayload.labels : [];
  const idExistsHere = requestedLabelId && existing.some((label) => label.id === requestedLabelId);
  if (idExistsHere) return requestedLabelId;

  const byName = existing.find((label) => (label.name || "").toLowerCase() === labelName.toLowerCase());
  if (byName?.id) return byName.id;
  if (remove) return null;

  const created = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: labelName, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  const createdPayload = created.ok ? await created.json().catch(() => null) : null;
  return createdPayload?.id || null;
}

async function applyLabelToMessage(
  accessToken: string,
  labelId: string,
  messageId: string,
  remove: boolean
): Promise<{ ok: boolean; error?: string }> {
  const body = remove ? { removeLabelIds: [labelId] } : { addLabelIds: [labelId] };
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (response.ok) return { ok: true };

    const text = await response.text().catch(() => "");
    // Rate limiting is transient and says nothing about this message, so retry it rather than
    // reporting a failure the user can only fix by clicking the same button again — see
    // pages/api/gmail/actions.ts for the same pattern on the other bulk-write endpoint.
    if (isRateLimited(response.status, text) && attempt < GMAIL_RATE_LIMIT_RETRIES) {
      await delay(backoffDelayMs(attempt));
      continue;
    }
    if (isRateLimited(response.status, text)) {
      return { ok: false, error: "Gmail is rate-limiting this account. Try these again in a moment." };
    }
    return { ok: false, error: text || "Failed to update label." };
  }
}

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;
    const requestedLabelId = asStr(req.body?.labelId).trim();
    const labelName = asStr(req.body?.labelName).trim();
    const remove = Boolean(req.body?.remove);
    if (!requestedLabelId && !labelName) {
      res.status(400).json({ message: "labelId or labelName is required." });
      return;
    }

    // Bulk shape: one label applied across possibly many messages/mailboxes in one request,
    // instead of the client firing one fetch per message with no shared rate-limit protection.
    const bulkItems = normalizeItems(req.body?.items);
    const items: LabelItem[] =
      bulkItems.length > 0
        ? bulkItems
        : (() => {
            const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
            const messageId = asStr(req.body?.messageId).trim();
            return accountEmail && messageId ? [{ accountEmail, messageId }] : [];
          })();
    if (items.length === 0) {
      res.status(400).json({ message: "accountEmail/messageId or items is required." });
      return;
    }

    const uniqueAccounts = Array.from(new Set(items.map((item) => item.accountEmail)));
    const tokenByAccount = new Map<string, string | null>();
    const ownerByAccount = new Map<string, { ownerUserId: string; tokenEmail: string } | null>();
    const labelIdByAccount = new Map<string, string | null>();
    const errorByAccount = new Map<string, string>();

    // Resolve access + token + the account-local label id ONCE per unique mailbox, not per
    // message — the expensive parts (grant lookup, list/create label) don't repeat per item.
    await Promise.all(
      uniqueAccounts.map(async (accountEmail) => {
        const access = await resolveMailboxOwner(userId, accountEmail);
        if (!access || !access.canSend) {
          ownerByAccount.set(accountEmail, null);
          errorByAccount.set(accountEmail, "You don't have permission to act on this mailbox.");
          return;
        }
        ownerByAccount.set(accountEmail, access);
        const token = await getValidGmailAccessToken(access.ownerUserId, access.tokenEmail);
        if (!token.ok) {
          errorByAccount.set(accountEmail, token.message);
          return;
        }
        tokenByAccount.set(accountEmail, token.accessToken);
        const labelId = await resolveLabelId(token.accessToken, requestedLabelId, labelName, remove);
        if (!labelId) {
          errorByAccount.set(accountEmail, "Label not found in this mailbox.");
          return;
        }
        labelIdByAccount.set(accountEmail, labelId);
      })
    );

    // Bounded concurrency across ALL items (not per-account) — see GMAIL_BATCH_CONCURRENCY.
    const results = await mapInBatches(
      items,
      async (item) => {
        const token = tokenByAccount.get(item.accountEmail);
        const labelId = labelIdByAccount.get(item.accountEmail);
        if (!token || !labelId) {
          return { ...item, ok: false, error: errorByAccount.get(item.accountEmail) || "Label update failed." };
        }
        const outcome = await applyLabelToMessage(token, labelId, item.messageId, remove);
        return { ...item, ...outcome };
      },
      GMAIL_BATCH_CONCURRENCY
    );

    const succeededAccounts = new Set(results.filter((r) => r.ok).map((r) => r.accountEmail));
    for (const accountEmail of succeededAccounts) {
      const owner = ownerByAccount.get(accountEmail);
      if (!owner) continue;
      invalidateGmailListCache(owner.ownerUserId, owner.tokenEmail);
      // Labelling can move a message out of a mailbox (Gmail labels are the mailbox), so the
      // cached badge counts for that account are stale too — not just the message list.
      invalidateGmailCountsCache(owner.ownerUserId, owner.tokenEmail);
    }

    const failures = results.filter((r) => !r.ok);
    if (failures.length > 0) {
      res.status(207).json({ message: "Some labels failed to update.", results });
      return;
    }
    res.status(200).json({ ok: true, results });
  },
  { methods: ["POST"] }
);
