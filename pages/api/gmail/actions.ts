import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { prisma } from "@/lib/prisma";

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
  | "moveToTrash";

type ActionItem = {
  accountEmail: string;
  messageId: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeItems(input: unknown): ActionItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      accountEmail: asString((item as any)?.accountEmail).toLowerCase(),
      messageId: asString((item as any)?.messageId),
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const action = asString(req.body?.action) as ActionType;
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
  ];
  if (!validActions.includes(action)) {
    res.status(400).json({ message: "Invalid action." });
    return;
  }
  if (items.length === 0) {
    res.status(400).json({ message: "No messages provided." });
    return;
  }

  const userId = Number((session.user as any).id);
  const uniqueAccounts = Array.from(new Set(items.map((item) => item.accountEmail)));
  const tokenMap = new Map<string, string | null>();
  for (const accountEmail of uniqueAccounts) {
    const tokenResult = await getValidGmailAccessToken(userId, accountEmail);
    tokenMap.set(accountEmail, tokenResult.ok ? tokenResult.accessToken : null);
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
          userId,
          OR: successfulItems.map((item) => ({
            accountEmail: item.accountEmail,
            gmailMessageId: item.messageId,
          })),
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
}
