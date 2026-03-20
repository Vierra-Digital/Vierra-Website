import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

type Mailbox = "inbox" | "sent" | "drafts" | "spam" | "trash" | "archive";
const OPEN_BASE_WINDOW_MS = 15_000;
const OPEN_SESSION_GAP_MS = 5 * 60 * 1000;
const OPEN_MAX_CONTINUOUS_STEP_MS = 60_000;

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

type MessageRow = {
  id: string;
  threadId: string;
  accountEmail: string;
  subject: string;
  from: string;
  to: string;
  fromRaw: string;
  toRaw: string;
  date: string;
  timestamp: number;
  snippet: string;
  mailbox: Mailbox;
  replyTo: string;
  messageIdHeader: string;
  references: string;
  unread: boolean;
  tracked: boolean;
  trackingOpenCount?: number;
  trackingClickCount?: number;
  trackingFirstOpenedAt?: string | null;
  trackingLastOpenedAt?: string | null;
  trackingTotalOpenWindowMs?: number;
  isComposeDraft?: boolean;
  draftKey?: string;
  composeCc?: string;
  composeBcc?: string;
  composeShowCc?: boolean;
  composeShowBcc?: boolean;
  composeBodyText?: string;
  composeBodyHtml?: string;
  composePreviewHtml?: string;
};

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseMailbox(v: string | undefined): Mailbox {
  const value = (v || "").toLowerCase();
  if (value === "sent") return "sent";
  if (value === "drafts") return "drafts";
  if (value === "spam") return "spam";
  if (value === "trash") return "trash";
  if (value === "archive") return "archive";
  return "inbox";
}

function buildMailboxQuery(mailbox: Mailbox) {
  if (mailbox === "archive") {
    return { q: "-in:inbox -in:sent -in:drafts -in:spam -in:trash" };
  }
  if (mailbox === "sent") {
    // Exclude trashed items so "delete from sent" disappears immediately from Sent view.
    return { q: "in:sent -in:trash" };
  }
  if (mailbox === "drafts") return "DRAFT";
  if (mailbox === "spam") return "SPAM";
  if (mailbox === "trash") return "TRASH";
  return "INBOX";
}

function extractHeader(headers: Array<{ name?: string; value?: string }> | undefined, key: string) {
  if (!headers) return "";
  const target = headers.find((h) => (h.name || "").toLowerCase() === key.toLowerCase());
  return target?.value || "";
}

function normalizeMailboxIdentity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const named = trimmed.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  if (named?.[1]) return named[1].trim().replace(/^"|"$/g, "");
  const emailMatch = trimmed.match(/<([^>]+)>/);
  if (emailMatch?.[1]) return emailMatch[1].trim();
  return trimmed;
}

function decodeHtmlEntities(value: string) {
  if (!value) return "";
  const namedDecoded = value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  const numericDecoded = namedDecoded
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });

  return numericDecoded;
}

function firstRecipient(text: string) {
  const cleaned = decodeHtmlEntities(text || "").trim();
  if (!cleaned) return "";
  const [first] = cleaned.split(",").map((entry) => entry.trim()).filter(Boolean);
  return first || cleaned;
}

async function fetchGmailList(accessToken: string, mailbox: Mailbox, maxResults: number) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  const mailboxQuery = buildMailboxQuery(mailbox);
  if (typeof mailboxQuery === "string") {
    params.set("labelIds", mailboxQuery);
  } else {
    params.set("q", mailboxQuery.q);
  }
  const response = await fetchWithRetry(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail list failed ${response.status}: ${text}`);
  }
  return (await response.json()) as GmailListResponse;
}

async function fetchGmailMessage(accessToken: string, id: string) {
  const params = new URLSearchParams({ format: "metadata" });
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "To");
  params.append("metadataHeaders", "Reply-To");
  params.append("metadataHeaders", "Date");
  params.append("metadataHeaders", "Message-ID");
  params.append("metadataHeaders", "References");
  const response = await fetchWithRetry(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gmail message failed ${response.status}: ${text}`);
  }
  return (await response.json()) as GmailMessageResponse;
}

function isAuthFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /gmail (list|message) failed 401/i.test(error.message);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(url, init);
    lastResponse = response;
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status) || i === attempts - 1) {
      return response;
    }
    await sleep(200 * (i + 1));
  }
  return lastResponse as Response;
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
  const mailbox = parseMailbox(asStr(req.query.mailbox));
  const pageRaw = Number(asStr(req.query.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSizeRaw = Number(asStr(req.query.limit));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 50;
  const maxResults = Math.min(page * pageSize, 500);
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

  if (accountRows.length === 0) {
    res.status(200).json({ messages: [], accountErrors: [] });
    return;
  }

  const accountErrors: Array<{ accountEmail: string; message: string }> = [];
  const accountHasMore: boolean[] = [];
  const messagesByAccount = await Promise.all(
    accountRows.map(async (account) => {
      try {
        const tokenResult = await getValidGmailAccessToken(userId, account.email);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }

        const loadAccountMessages = async (accessToken: string) => {
          const list = await fetchGmailList(accessToken, mailbox, maxResults);
          accountHasMore.push(Boolean(list.nextPageToken));
          const ids = (list.messages || []).map((m) => m.id).filter(Boolean);
          if (ids.length === 0) return [] as MessageRow[];

          const detailed = await Promise.all(ids.map((id) => fetchGmailMessage(accessToken, id)));
          const visibleDetailed =
            mailbox === "sent"
              ? detailed.filter((msg) => !(Array.isArray(msg.labelIds) && msg.labelIds.includes("TRASH")))
              : detailed;
          return visibleDetailed.map((msg) => {
            const headers = msg.payload?.headers || [];
            const subject = decodeHtmlEntities(extractHeader(headers, "Subject") || "(No Subject)");
            const from = decodeHtmlEntities(extractHeader(headers, "From") || "");
            const to = decodeHtmlEntities(extractHeader(headers, "To") || "");
            const replyTo = decodeHtmlEntities(extractHeader(headers, "Reply-To") || from);
            const date = extractHeader(headers, "Date") || "";
            const messageIdHeader = extractHeader(headers, "Message-ID") || "";
            const references = extractHeader(headers, "References") || "";
            const timestamp = Number(msg.internalDate || 0) || Date.parse(date) || 0;
            const unread = Array.isArray(msg.labelIds) ? msg.labelIds.includes("UNREAD") : false;
            return {
              id: msg.id,
              threadId: msg.threadId,
              accountEmail: account.email,
              subject,
              from: normalizeMailboxIdentity(from),
              to: normalizeMailboxIdentity(to),
              fromRaw: from,
              toRaw: to,
              date,
              timestamp,
              snippet: decodeHtmlEntities(msg.snippet || ""),
              mailbox,
              replyTo,
              messageIdHeader,
              references,
              unread,
              tracked: false,
            } as MessageRow;
          });
        };

        try {
          return await loadAccountMessages(tokenResult.accessToken);
        } catch (error) {
          if (!isAuthFailure(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(userId, account.email, { forceRefresh: true });
          if (!refreshResult.ok) {
            throw new Error(refreshResult.message);
          }
          return await loadAccountMessages(refreshResult.accessToken);
        }
      } catch (error) {
        accountHasMore.push(false);
        const message = error instanceof Error ? error.message : "Failed to fetch account messages";
        accountErrors.push({ accountEmail: account.email, message });
        return [] as MessageRow[];
      }
    })
  );

  let mergedMessages = messagesByAccount.flat().sort((a, b) => b.timestamp - a.timestamp);
  if (mailbox === "drafts") {
    const composeDraftRows = await prisma.emailComposeDraft.findMany({
      where: {
        userId,
        ...(selectedEmails.length
          ? {
              OR: [
                { accountEmail: null },
                { accountEmail: { in: selectedEmails } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    const mappedDrafts: MessageRow[] = composeDraftRows.map((draft) => {
      const accountEmail = (draft.accountEmail || selectedEmails[0] || accountRows[0]?.email || "").toLowerCase();
      const timestamp = draft.updatedAt.getTime();
      const recipientLabel =
        firstRecipient(draft.toText || "") || firstRecipient(draft.ccText || "") || firstRecipient(draft.bccText || "");
      return {
        id: `draftdb:${draft.id}`,
        threadId: draft.threadId || "",
        accountEmail,
        subject: decodeHtmlEntities(draft.subject || "(No Subject)"),
        from: recipientLabel || "(Draft)",
        to: decodeHtmlEntities(draft.toText || ""),
        fromRaw: decodeHtmlEntities(draft.toText || ""),
        toRaw: decodeHtmlEntities(draft.toText || ""),
        date: draft.updatedAt.toUTCString(),
        timestamp,
        snippet: decodeHtmlEntities((draft.bodyText || "").slice(0, 220)),
        mailbox: "drafts",
        replyTo: "",
        messageIdHeader: draft.inReplyTo || "",
        references: draft.references || "",
        unread: false,
        tracked: false,
        isComposeDraft: true,
        draftKey: draft.draftKey,
        composeCc: draft.ccText || "",
        composeBcc: draft.bccText || "",
        composeShowCc: Boolean(draft.showCc),
        composeShowBcc: Boolean(draft.showBcc),
        composeBodyText: draft.bodyText || "",
        composeBodyHtml: draft.bodyHtml || "",
        composePreviewHtml: draft.previewHtml || "",
      };
    });
    mergedMessages = [...mappedDrafts, ...mergedMessages].sort((a, b) => b.timestamp - a.timestamp);
  }
  const offset = (page - 1) * pageSize;
  const pageMessages = mergedMessages.slice(offset, offset + pageSize);
  const trackedRows = await prisma.emailOutboundMessage.findMany({
    where: {
      userId,
      trackingEnabled: true,
      gmailMessageId: { in: pageMessages.map((message) => message.id) },
    },
    select: {
      gmailMessageId: true,
      accountEmail: true,
      trackingEvents: {
        where: { eventType: { in: ["OPEN", "CLICK"] } },
        select: {
          eventType: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  const trackedStatsByKey = new Map<
    string,
    { openCount: number; clickCount: number; firstOpenedAt: string | null; lastOpenedAt: string | null; totalOpenWindowMs: number }
  >();
  for (const row of trackedRows) {
    if (!row.gmailMessageId) continue;
    const key = `${row.accountEmail.toLowerCase()}::${String(row.gmailMessageId)}`;
    let openCount = 0;
    let clickCount = 0;
    let firstOpenedAt: Date | null = null;
    let lastOpenedAt: Date | null = null;
    const openTimestamps: number[] = [];
    for (const event of row.trackingEvents) {
      if (event.eventType === "OPEN") {
        openCount += 1;
        openTimestamps.push(event.occurredAt.getTime());
        if (!firstOpenedAt || event.occurredAt < firstOpenedAt) {
          firstOpenedAt = event.occurredAt;
        }
        if (!lastOpenedAt || event.occurredAt > lastOpenedAt) {
          lastOpenedAt = event.occurredAt;
        }
      } else if (event.eventType === "CLICK") {
        clickCount += 1;
      }
    }
    let totalOpenWindowMs = 0;
    if (openTimestamps.length > 0) {
      totalOpenWindowMs += OPEN_BASE_WINDOW_MS;
      for (let idx = 1; idx < openTimestamps.length; idx += 1) {
        const gapMs = openTimestamps[idx] - openTimestamps[idx - 1];
        if (gapMs <= OPEN_SESSION_GAP_MS) {
          totalOpenWindowMs += Math.min(Math.max(gapMs, 0), OPEN_MAX_CONTINUOUS_STEP_MS);
        } else {
          totalOpenWindowMs += OPEN_BASE_WINDOW_MS;
        }
      }
    }
    trackedStatsByKey.set(key, {
      openCount,
      clickCount,
      firstOpenedAt: firstOpenedAt ? firstOpenedAt.toISOString() : null,
      lastOpenedAt: lastOpenedAt ? lastOpenedAt.toISOString() : null,
      totalOpenWindowMs,
    });
  }
  const messages = pageMessages.map((message) => ({
    ...message,
    tracked: trackedStatsByKey.has(`${message.accountEmail.toLowerCase()}::${message.id}`),
    trackingOpenCount: trackedStatsByKey.get(`${message.accountEmail.toLowerCase()}::${message.id}`)?.openCount || 0,
    trackingClickCount: trackedStatsByKey.get(`${message.accountEmail.toLowerCase()}::${message.id}`)?.clickCount || 0,
    trackingFirstOpenedAt: trackedStatsByKey.get(`${message.accountEmail.toLowerCase()}::${message.id}`)?.firstOpenedAt || null,
    trackingLastOpenedAt: trackedStatsByKey.get(`${message.accountEmail.toLowerCase()}::${message.id}`)?.lastOpenedAt || null,
    trackingTotalOpenWindowMs: trackedStatsByKey.get(`${message.accountEmail.toLowerCase()}::${message.id}`)?.totalOpenWindowMs || 0,
  }));
  const hasNextPage = mergedMessages.length > offset + pageSize || accountHasMore.some(Boolean);

  res.status(200).json({
    mailbox,
    messages,
    accountErrors,
    page,
    pageSize,
    totalLoaded: mergedMessages.length,
    hasNextPage,
  });
}
