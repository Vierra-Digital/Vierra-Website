import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";

type ActionType =
  | "trash"
  | "deletePermanently"
  | "spam"
  | "unspam"
  | "untrash"
  | "markRead"
  | "markUnread"
  | "archive"
  | "moveToInbox"
  | "moveToSpam"
  | "moveToTrash"
  | "star"
  | "unstar";

type ActionItem = {
  accountEmail: string;
  messageId: string;
};

function normalizeItems(input: unknown): ActionItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      accountEmail: asStr((item as any)?.accountEmail).toLowerCase(),
      messageId: asStr((item as any)?.messageId),
    }))
    .filter((item) => item.accountEmail && item.messageId);
}

/**
 * Per-request cap on a single Gmail call. Without it one stalled upstream request holds the whole
 * serverless invocation until the platform kills it, which surfaces to the client as an opaque
 * 502 after a long wait instead of a usable error.
 */
const GMAIL_CALL_TIMEOUT_MS = 10_000;

/** fetch with a hard timeout, so a hung Gmail request fails fast and reports why. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GMAIL_CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGmailAction(accessToken: string, action: ActionType, messageId: string) {
  const encodedId = encodeURIComponent(messageId);
  if (action === "deletePermanently") {
    return fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (action === "trash" || action === "moveToTrash") {
    return fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/trash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (action === "untrash") {
    return fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/untrash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const body: { addLabelIds: string[]; removeLabelIds: string[] } = { addLabelIds: [], removeLabelIds: [] };
  if (action === "archive") {
    // Also drop SPAM: archiving a message that lives in Spam only removed INBOX, which it
    // never had, so the message stayed exactly where it was and the action looked broken.
    body.removeLabelIds = ["INBOX", "SPAM"];
  } else if (action === "moveToInbox" || action === "unspam") {
    body.addLabelIds = ["INBOX"];
    body.removeLabelIds = ["SPAM"];
  } else if (action === "moveToSpam" || action === "spam") {
    body.addLabelIds = ["SPAM"];
    body.removeLabelIds = ["INBOX"];
  } else if (action === "markRead") {
    body.removeLabelIds = ["UNREAD"];
  } else if (action === "markUnread") {
    body.addLabelIds = ["UNREAD"];
  } else if (action === "star") {
    body.addLabelIds = ["STARRED"];
  } else if (action === "unstar") {
    body.removeLabelIds = ["STARRED"];
  }

  return fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/modify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export default withAuth(async (req, res, session) => {
  const action = asStr(req.body?.action) as ActionType;
  const items = normalizeItems(req.body?.items);
  const validActions: ActionType[] = [
    "trash",
    "deletePermanently",
    "spam",
    "unspam",
    "untrash",
    "markRead",
    "markUnread",
    "archive",
    "moveToInbox",
    "moveToSpam",
    "moveToTrash",
    "star",
    "unstar",
  ];
  if (!validActions.includes(action)) {
    res.status(400).json({ message: "Invalid action." });
    return;
  }
  if (items.length === 0) {
    res.status(400).json({ message: "No messages provided." });
    return;
  }

  const userId = session.user.id;
  const uniqueAccounts = Array.from(new Set(items.map((item) => item.accountEmail)));
  const tokenMap = new Map<string, string | null>();
  // Resolve WHOSE token to act with: your own mailbox, or a shared inbox you were granted WITH send
  // permission. Read-only grants (canSend false) resolve to null → their actions fail as "no
  // permission" rather than silently running against your own (missing) token.
  const ownerMap = new Map<string, string | null>();
  for (const accountEmail of uniqueAccounts) {
    const access = await resolveMailboxOwner(userId, accountEmail);
    const ownerUserId = access && access.canSend ? access.ownerUserId : null;
    ownerMap.set(accountEmail, ownerUserId);
    const tokenResult = ownerUserId
      ? await getValidGmailAccessToken(ownerUserId, accountEmail)
      : { ok: false as const };
    tokenMap.set(accountEmail, tokenResult.ok ? tokenResult.accessToken : null);
  }
  // Resolve accountEmail -> account_id for outbound message cleanup. Scoped to the mailbox
  // OWNER's user_id (from ownerMap above), not the requester's — for a shared/delegated inbox
  // the EmailProviderAccount row (and the EmailOutboundMessage rows it's cleaned up against
  // below) belongs to the owner, not whichever delegate happened to click delete. Scoping this
  // to `userId` meant a delegate's permanent delete of another user's granted mailbox would
  // never match here, silently leaving orphaned outbound/tracking rows behind.
  const accountIdMap = new Map<string, string | null>();
  const accountOwnerIdMap = new Map<string, string>();
  if (uniqueAccounts.length > 0) {
    const ownerClauses = uniqueAccounts
      .map((accountEmail) => {
        const ownerUserId = ownerMap.get(accountEmail) || userId;
        return { user_id: ownerUserId, account_email: accountEmail };
      });
    const providerAccounts = await prisma.emailProviderAccount.findMany({
      where: { OR: ownerClauses },
      select: { id: true, account_email: true, user_id: true },
    });
    for (const pa of providerAccounts) {
      accountIdMap.set(pa.account_email.toLowerCase(), pa.id);
      accountOwnerIdMap.set(pa.account_email.toLowerCase(), pa.user_id);
    }
  }

  const results = await Promise.all(
    items.map(async (item) => {
      const token = tokenMap.get(item.accountEmail);
      if (!token) {
        const owner = ownerMap.get(item.accountEmail);
        return {
          ...item,
          ok: false,
          error: owner ? "Account token not found" : "You don't have permission to act on this mailbox.",
        };
      }
      try {
        const owner = ownerMap.get(item.accountEmail) || userId;
        let response = await callGmailAction(token, action, item.messageId);
        if (response.status === 401) {
          const refreshResult = await getValidGmailAccessToken(owner, item.accountEmail, { forceRefresh: true });
          if (!refreshResult.ok) {
            return { ...item, ok: false, error: refreshResult.message };
          }
          response = await callGmailAction(refreshResult.accessToken, action, item.messageId);
        }
        if (!response.ok) {
          const text = await response.text();
          const normalized = String(text || "");
          if (response.status === 403 && /insufficientpermissions|insufficient permissions|forbidden/i.test(normalized)) {
            return {
              ...item,
              ok: false,
              error: "Gmail account needs reconnect with modify permissions to delete/move messages.",
            };
          }
          return { ...item, ok: false, error: normalized || `Gmail action failed (${response.status})` };
        }
        return { ...item, ok: true };
      } catch (error) {
        // A timeout aborts only this item's call, so the rest of the batch still reports normally.
        // Name it explicitly — "The operation was aborted" tells the user nothing actionable.
        if ((error as Error)?.name === "AbortError") {
          return { ...item, ok: false, error: "Gmail didn't respond in time. The message was not changed." };
        }
        return { ...item, ok: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    })
  );

  const failures = results.filter((result) => !result.ok);
  if (action === "deletePermanently" && results.length > 0) {
    const successfulItems = results.filter((result) => result.ok);
    if (successfulItems.length > 0) {
      await prisma.emailOutboundMessage.deleteMany({
        where: {
          OR: successfulItems
            .map((item) => {
              const accountId = accountIdMap.get(item.accountEmail.toLowerCase());
              const ownerUserId = accountOwnerIdMap.get(item.accountEmail.toLowerCase());
              if (!accountId || !ownerUserId) return null;
              return { account_id: accountId, gmail_message_id: item.messageId, user_id: ownerUserId };
            })
            .filter((c): c is { account_id: string; gmail_message_id: string; user_id: string } => c !== null),
        },
      });
    }
  }
  if (failures.length > 0) {
    res.status(207).json({
      message: "Some actions failed.",
      results,
    });
    return;
  }

  res.status(200).json({ ok: true, results });
}, { methods: ["POST"] });
