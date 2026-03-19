import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

type GmailLabel = {
  id?: string;
  messagesUnread?: number;
};

type GmailLabelsResponse = {
  labels?: GmailLabel[];
};

type GmailListEstimateResponse = {
  resultSizeEstimate?: number;
};

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function readLabelUnreadCount(labels: GmailLabel[], id: string) {
  const label = labels.find((entry) => (entry.id || "").toUpperCase() === id.toUpperCase());
  return Number(label?.messagesUnread || 0);
}

async function fetchEstimate(accessToken: string, query: string) {
  const params = new URLSearchParams({
    q: query,
    maxResults: "1",
    fields: "resultSizeEstimate",
  });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail unread estimate failed ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as GmailListEstimateResponse;
  return Number(payload.resultSizeEstimate || 0);
}

async function fetchMailboxCounts(accessToken: string) {
  const [inbox, sent, draftsTotal, spam, trash, archive] = await Promise.all([
    fetchEstimate(accessToken, "in:inbox is:unread"),
    fetchEstimate(accessToken, "in:sent is:unread"),
    fetchEstimate(accessToken, "in:drafts"),
    fetchEstimate(accessToken, "in:spam is:unread"),
    fetchEstimate(accessToken, "in:trash is:unread"),
    fetchEstimate(accessToken, "-in:inbox -in:sent -in:drafts -in:spam -in:trash is:unread"),
  ]);

  // Keep a labels fallback in place for resilience if Gmail query behavior changes.
  let labelsFallback: GmailLabel[] = [];
  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.ok) {
      const payload = (await response.json()) as GmailLabelsResponse;
      labelsFallback = Array.isArray(payload.labels) ? payload.labels : [];
    }
  } catch {
    // Best-effort fallback only.
  }

  return {
    inbox: Number.isFinite(inbox) ? inbox : readLabelUnreadCount(labelsFallback, "INBOX"),
    sent: Number.isFinite(sent) ? sent : readLabelUnreadCount(labelsFallback, "SENT"),
    drafts: Number.isFinite(draftsTotal) ? draftsTotal : readLabelUnreadCount(labelsFallback, "DRAFT"),
    spam: Number.isFinite(spam) ? spam : readLabelUnreadCount(labelsFallback, "SPAM"),
    trash: Number.isFinite(trash) ? trash : readLabelUnreadCount(labelsFallback, "TRASH"),
    archive,
  };
}

function isAuthError(error: unknown) {
  return error instanceof Error && /gmail unread estimate failed 401/i.test(error.message);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const accountsParam = asStr(req.query.accounts);
  const selectedEmails = (accountsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const rows = await prisma.userToken.findMany({
    where: { userId, platform: { startsWith: "gmail:" } },
    select: { platform: true },
  });

  const accountRows = rows
    .map((row) => ({
      email: row.platform.replace(/^gmail:/, "").toLowerCase(),
    }))
    .filter((row) => (selectedEmails.length ? selectedEmails.includes(row.email) : true));

  const composeDraftWhere = {
    userId,
    ...(selectedEmails.length
      ? {
          OR: [
            { accountEmail: null },
            { accountEmail: { in: selectedEmails } },
          ],
        }
      : {}),
  } as const;

  if (accountRows.length === 0) {
    const composeDraftCount = await prisma.emailComposeDraft.count({ where: composeDraftWhere });
    res.status(200).json({
      counts: { inbox: 0, sent: 0, drafts: composeDraftCount, spam: 0, trash: 0, archive: 0 },
      accountErrors: [],
    });
    return;
  }

  const accountErrors: Array<{ accountEmail: string; message: string }> = [];
  const aggregated = { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, archive: 0 };

  await Promise.all(
    accountRows.map(async (account) => {
      try {
        const tokenResult = await getValidGmailAccessToken(userId, account.email);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }
        let counts: Awaited<ReturnType<typeof fetchMailboxCounts>>;
        try {
          counts = await fetchMailboxCounts(tokenResult.accessToken);
        } catch (error) {
          if (!isAuthError(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(userId, account.email, { forceRefresh: true });
          if (!refreshResult.ok) {
            throw new Error(refreshResult.message);
          }
          counts = await fetchMailboxCounts(refreshResult.accessToken);
        }
        aggregated.inbox += counts.inbox;
        aggregated.sent += counts.sent;
        aggregated.drafts += counts.drafts;
        aggregated.spam += counts.spam;
        aggregated.trash += counts.trash;
        aggregated.archive += counts.archive;
      } catch (error) {
        accountErrors.push({
          accountEmail: account.email,
          message: error instanceof Error ? error.message : "Failed to load label counts",
        });
      }
    })
  );

  const composeDraftCount = await prisma.emailComposeDraft.count({ where: composeDraftWhere });
  aggregated.drafts += composeDraftCount;

  res.status(200).json({
    counts: aggregated,
    accountErrors,
  });
}
