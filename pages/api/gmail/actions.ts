import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
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

async function callGmailAction(accessToken: string, action: ActionType, messageId: string) {
  const encodedId = encodeURIComponent(messageId);
  if (action === "deletePermanently") {
    return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (action === "trash") {
    return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/trash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (action === "moveToTrash") {
    return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/trash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (action === "untrash") {
    return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/untrash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const body: { addLabelIds: string[]; removeLabelIds: string[] } = { addLabelIds: [], removeLabelIds: [] };
  if (action === "archive") {
    body.removeLabelIds = ["INBOX"];
  } else if (action === "moveToInbox") {
    body.addLabelIds = ["INBOX"];
    body.removeLabelIds = ["SPAM"];
  } else if (action === "moveToSpam" || action === "spam") {
    body.addLabelIds = ["SPAM"];
    body.removeLabelIds = ["INBOX"];
  } else if (action === "unspam") {
    body.addLabelIds = ["INBOX"];
    body.removeLabelIds = ["SPAM"];
  } else if (action === "markRead") {
    body.removeLabelIds = ["UNREAD"];
  } else if (action === "markUnread") {
    body.addLabelIds = ["UNREAD"];
  } else if (action === "star") {
    body.addLabelIds = ["STARRED"];
  } else if (action === "unstar") {
    body.removeLabelIds = ["STARRED"];
  }

  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodedId}/modify`, {
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
  for (const accountEmail of uniqueAccounts) {
    const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
    tokenMap.set(accountEmail, tokenResult.ok ? tokenResult.accessToken : null);
  }
  // Resolve accountEmail -> account_id for outbound message cleanup
  const accountIdMap = new Map<string, string | null>();
  if (uniqueAccounts.length > 0) {
    const providerAccounts = await prisma.emailProviderAccount.findMany({
      where: { user_id: userId, account_email: { in: uniqueAccounts } },
      select: { id: true, account_email: true },
    });
    for (const pa of providerAccounts) {
      accountIdMap.set(pa.account_email.toLowerCase(), pa.id);
    }
  }

  const results = await Promise.all(
    items.map(async (item) => {
      const token = tokenMap.get(item.accountEmail);
      if (!token) {
        return { ...item, ok: false, error: "Account token not found" };
      }
      try {
        let response = await callGmailAction(token, action, item.messageId);
        if (response.status === 401) {
          const refreshResult = await getValidGmailAccessToken(userId, item.accountEmail, { forceRefresh: true });
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
          user_id: userId,
          OR: successfulItems
            .map((item) => {
              const accountId = accountIdMap.get(item.accountEmail.toLowerCase());
              if (!accountId) return null;
              return { account_id: accountId, gmail_message_id: item.messageId };
            })
            .filter((c): c is { account_id: string; gmail_message_id: string } => c !== null),
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
