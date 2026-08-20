import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { mapInBatches } from "@/lib/batch";
import { invalidateGmailListCache } from "@/lib/gmail/messageListCache";

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

/**
 * How many of a batch's Gmail calls run at once.
 *
 * Firing a whole selection in parallel is what produced "Too many concurrent requests for user":
 * Gmail limits concurrency per user, so a 28-message bulk action had several items rejected with 429
 * while the rest succeeded — a partial failure the user then had to retry by hand.
 */
const ACTION_CONCURRENCY = 5;
/** Kept low deliberately: the client aborts the whole request at 15s, so retries must fit inside it. */
const RATE_LIMIT_RETRIES = 2;

/** Gmail signals rate limiting as 429, and as 403 with a rate-limit reason in the body. */
function isRateLimited(status: number, body: string): boolean {
  if (status === 429) return true;
  return status === 403 && /rateLimitExceeded|userRateLimitExceeded|Too many concurrent requests/i.test(body);
}

/** Exponential backoff with jitter, so retried items in one batch don't resynchronise. */
function backoffDelayMs(attempt: number): number {
  return 300 * 2 ** attempt + Math.floor(Math.random() * 150);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // A send-as alias has no OAuth token of its own — its mail lives in the account that owns it, so
  // the token has to be fetched for that address, not for the alias. Kept per requested account so
  // the retry path below can look it up again.
  const tokenEmailMap = new Map<string, string>();
  for (const accountEmail of uniqueAccounts) {
    const access = await resolveMailboxOwner(userId, accountEmail);
    const ownerUserId = access && access.canSend ? access.ownerUserId : null;
    ownerMap.set(accountEmail, ownerUserId);
    const tokenEmail = access?.tokenEmail || accountEmail;
    tokenEmailMap.set(accountEmail, tokenEmail);
    const tokenResult = ownerUserId
      ? await getValidGmailAccessToken(ownerUserId, tokenEmail)
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

  // Bounded concurrency rather than all at once — see ACTION_CONCURRENCY.
  const results = await mapInBatches(
    items,
    async (item) => {
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
        let activeToken = token;
        for (let attempt = 0; ; attempt += 1) {
          let response = await callGmailAction(activeToken, action, item.messageId);
          if (response.status === 401) {
            const refreshResult = await getValidGmailAccessToken(
              owner,
              tokenEmailMap.get(item.accountEmail) || item.accountEmail,
              { forceRefresh: true }
            );
            if (!refreshResult.ok) {
              return { ...item, ok: false, error: refreshResult.message };
            }
            activeToken = refreshResult.accessToken;
            response = await callGmailAction(activeToken, action, item.messageId);
          }
          if (response.ok) return { ...item, ok: true };

          const text = await response.text();
          const normalized = String(text || "");
          // Rate limiting is transient and says nothing about this message, so retry it rather than
          // reporting a failure the user can only fix by clicking the same button again.
          if (isRateLimited(response.status, normalized) && attempt < RATE_LIMIT_RETRIES) {
            await delay(backoffDelayMs(attempt));
            continue;
          }
          if (isRateLimited(response.status, normalized)) {
            return { ...item, ok: false, error: "Gmail is rate-limiting this account. Try these again in a moment." };
          }
          if (response.status === 403 && /insufficientpermissions|insufficient permissions|forbidden/i.test(normalized)) {
            return {
              ...item,
              ok: false,
              error: "Gmail account needs reconnect with modify permissions to delete/move messages.",
            };
          }
          return { ...item, ok: false, error: normalized || `Gmail action failed (${response.status})` };
        }
      } catch (error) {
        // A timeout aborts only this item's call, so the rest of the batch still reports normally.
        // Name it explicitly — "The operation was aborted" tells the user nothing actionable.
        if ((error as Error)?.name === "AbortError") {
          return { ...item, ok: false, error: "Gmail didn't respond in time. The message was not changed." };
        }
        return { ...item, ok: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
    ACTION_CONCURRENCY
  );

  // Any of these actions change what a mailbox view would return (read state, labels, presence),
  // so the cached list window for the affected account is stale the moment this succeeds.
  const succeededAccounts = new Set(results.filter((result) => result.ok).map((result) => result.accountEmail));
  for (const accountEmail of succeededAccounts) {
    const owner = ownerMap.get(accountEmail);
    const tokenEmail = tokenEmailMap.get(accountEmail) || accountEmail;
    if (owner) invalidateGmailListCache(owner, tokenEmail);
  }

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
