import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getAccessibleGmailAccounts, getGmailAliasAccounts, selectFetchAccounts } from "@/lib/email/mailboxAccess";
import { extractHeader, buildAliasScopeQuery } from "@/lib/gmail/gmailApi";
import { asQueryStr } from "@/lib/api/parsing";
import { mapInBatches } from "@/lib/batch";
import {
  getAccountBucket,
  getStaleCacheEntry,
  freshCacheEntry,
  putCacheEntry,
  withListLock,
  type CacheEntry,
} from "@/lib/gmail/messageListCache";

type Mailbox = "inbox" | "sent" | "drafts" | "spam" | "trash" | "archive" | "allmail" | "starred" | "important" | "scheduled";
/**
 * Concurrency for per-message GET calls when filling in a list page. Gmail's write endpoints cap
 * at 5 (see pages/api/gmail/actions.ts) specifically because concurrent *writes* triggered "Too
 * many concurrent requests for user" — reads carry a materially higher per-user quota, so reusing
 * the write-path ceiling here just makes a 50-message page wait through ~5 sequential rounds of
 * latency for no rate-limit benefit.
 */
const MESSAGE_DETAIL_CONCURRENCY = 20;
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
  starred?: boolean;
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


function parseMailbox(v: string | undefined): Mailbox {
  const value = (v || "").toLowerCase();
  if (value === "sent") return "sent";
  if (value === "drafts") return "drafts";
  if (value === "spam") return "spam";
  if (value === "trash") return "trash";
  if (value === "archive") return "archive";
  if (value === "allmail") return "allmail";
  if (value === "starred") return "starred";
  if (value === "important") return "important";
  if (value === "scheduled") return "scheduled";
  return "inbox";
}

function buildMailboxQuery(mailbox: Mailbox) {
  if (mailbox === "archive") {
    return { q: "-in:inbox -in:sent -in:drafts -in:spam -in:trash" };
  }
  if (mailbox === "sent") {
    return { q: "in:sent -in:trash" };
  }
  if (mailbox === "allmail") return { q: "-in:trash -in:spam" };
  if (mailbox === "starred") return { q: "is:starred -in:trash" };
  if (mailbox === "important") return { q: "is:important -in:trash -in:spam" };
  if (mailbox === "scheduled") return { q: "in:scheduled" };
  if (mailbox === "drafts") return "DRAFT";
  if (mailbox === "spam") return "SPAM";
  if (mailbox === "trash") return "TRASH";
  return "INBOX";
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

async function fetchGmailList(
  accessToken: string,
  mailbox: Mailbox,
  maxResults: number,
  search?: string,
  labelId?: string,
  pageToken?: string
) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  const searchTerm = (search || "").trim();
  if (labelId) {
    // Viewing a custom label overrides the mailbox filter.
    params.set("labelIds", labelId);
    if (searchTerm) params.set("q", searchTerm);
  } else {
    const mailboxQuery = buildMailboxQuery(mailbox);
    if (typeof mailboxQuery === "string") {
      params.set("labelIds", mailboxQuery);
      if (searchTerm) params.set("q", searchTerm);
    } else {
      params.set("q", searchTerm ? `${mailboxQuery.q} ${searchTerm}` : mailboxQuery.q);
    }
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

type HistoryLabelId = "INBOX" | "SPAM" | "TRASH" | "STARRED" | "IMPORTANT" | "SENT" | "DRAFT";

/**
 * Only views that map 1:1 onto a single Gmail system label can be safely repaired via the
 * History API's `labelId` filter — everything else (free-text search, a custom label, "archive"
 * which is defined as the ABSENCE of several labels, "allmail"/"scheduled" which are compound
 * queries) has no equivalent history filter, and always takes the existing full list+get path.
 */
function historyLabelIdFor(mailbox: Mailbox, labelIdFilter: string, searchQuery: string): HistoryLabelId | null {
  if (labelIdFilter || searchQuery.trim()) return null;
  switch (mailbox) {
    case "inbox": return "INBOX";
    case "spam": return "SPAM";
    case "trash": return "TRASH";
    case "starred": return "STARRED";
    case "important": return "IMPORTANT";
    case "sent": return "SENT";
    case "drafts": return "DRAFT";
    default: return null;
  }
}

/** The mailbox's current change-cursor — the baseline a later request diffs against via history.list. */
async function fetchMailboxHistoryId(accessToken: string): Promise<string | null> {
  const response = await fetchWithRetry("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { historyId?: string };
  return payload.historyId || null;
}

type HistoryListResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
    messagesDeleted?: Array<{ message?: { id?: string } }>;
    labelsAdded?: Array<{ message?: { id?: string } }>;
    labelsRemoved?: Array<{ message?: { id?: string } }>;
  }>;
  historyId?: string;
  nextPageToken?: string;
};

/** Bound the worst case of a very stale historyId — beyond this, trust a full resync instead. */
const HISTORY_PAGE_CAP = 5;

/**
 * Which message ids newly entered or left `labelId` since `startHistoryId`. Gmail filters
 * history records to this label server-side, so a messagesAdded/labelsAdded record always means
 * "now has this label" and labelsRemoved/messagesDeleted always means "no longer does" — no need
 * to re-check labelIds locally.
 *
 * Returns null when the delta can't be trusted: a 404 means `startHistoryId` fell outside
 * Gmail's retained history window (it only keeps about a week), and hitting the page cap means
 * there were too many changes to be sure a partial read isn't missing an add/remove pair split
 * across the untruncated pages. Either way the caller must fall back to a full list+get, exactly
 * as it would for a plain cache miss — this is a latency optimization, never a correctness path.
 */
async function fetchLabelHistoryDelta(
  accessToken: string,
  startHistoryId: string,
  labelId: HistoryLabelId
): Promise<{ added: Set<string>; removed: Set<string>; historyId: string } | null> {
  const added = new Set<string>();
  const removed = new Set<string>();
  let latestHistoryId = startHistoryId;
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({ startHistoryId, labelId });
    params.append("historyTypes", "messageAdded");
    params.append("historyTypes", "messageDeleted");
    params.append("historyTypes", "labelAdded");
    params.append("historyTypes", "labelRemoved");
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetchWithRetry(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as HistoryListResponse;
    if (payload.historyId) latestHistoryId = payload.historyId;

    for (const record of payload.history || []) {
      for (const item of record.messagesAdded || []) {
        if (!item.message?.id) continue;
        added.add(item.message.id);
        removed.delete(item.message.id);
      }
      for (const item of record.labelsAdded || []) {
        if (!item.message?.id) continue;
        added.add(item.message.id);
        removed.delete(item.message.id);
      }
      for (const item of record.labelsRemoved || []) {
        if (!item.message?.id) continue;
        removed.add(item.message.id);
        added.delete(item.message.id);
      }
      for (const item of record.messagesDeleted || []) {
        if (!item.message?.id) continue;
        removed.add(item.message.id);
        added.delete(item.message.id);
      }
    }

    pageToken = payload.nextPageToken;
    pages += 1;
  } while (pageToken && pages < HISTORY_PAGE_CAP);

  if (pageToken) return null;
  return { added, removed, historyId: latestHistoryId };
}

export default withAuth(async (req, res, session) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const userId = session.user.id;
  const mailbox = parseMailbox(asQueryStr(req.query.mailbox));
  const pageRaw = Number(asQueryStr(req.query.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSizeRaw = Number(asQueryStr(req.query.limit));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 50) : 50;
  // We fetch (and merge/sort) at most the newest MAX_FETCH messages per account, so global
  // recency order is only trustworthy within [0, MAX_FETCH]. Pages beyond that can't be served
  // correctly with a merge-and-slice, so the inbox is capped there.
  const MAX_FETCH = 500;
  const maxResults = Math.min(page * pageSize, MAX_FETCH);
  const accountsParam = asQueryStr(req.query.accounts);
  const searchQuery = (asQueryStr(req.query.q) || "").trim();
  const labelIdFilter = (asQueryStr(req.query.labelId) || "").trim();
  const selectedEmails = (accountsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Accessible = owned + admin-granted (shared inboxes). Each carries the ownerUserId whose
  // token/data to use; for owned accounts ownerUserId === userId (identical to before).
  const accessibleAccounts = await getAccessibleGmailAccounts(userId);
  // Selected accounts, plus any selected send-as alias resolved back to the account that holds its
  // mail — and never an alias whose parent is already being read, which would return it twice.
  const accountRows = selectFetchAccounts(
    accessibleAccounts,
    selectedEmails.some((email) => !accessibleAccounts.some((row) => row.email === email))
      ? await getGmailAliasAccounts(userId)
      : [],
    selectedEmails
  );

  if (accountRows.length === 0) {
    res.status(200).json({ messages: [], accountErrors: [] });
    return;
  }

  const accountErrors: Array<{ accountEmail: string; message: string }> = [];
  const accountHasMore: boolean[] = [];
  const messagesByAccount = await Promise.all(
    accountRows.map(async (account) => {
      try {
        const tokenAccountEmail = account.aliasOfEmail || account.email;
        const tokenResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail);
        if (!tokenResult.ok) {
          throw new Error(tokenResult.message);
        }

        // An alias has no inbox of its own — it shares the owning account's, so scope the fetch
        // to just the mail addressed to (or, for sent/drafts, sent from) that alias.
        const aliasDirection = mailbox === "sent" || mailbox === "drafts" ? "from" : "to";
        const effectiveSearch = account.aliasOfEmail
          ? `${buildAliasScopeQuery(account.email, aliasDirection)} ${searchQuery}`.trim()
          : searchQuery;

        const mapDetailedMessages = (detailed: GmailMessageResponse[]): MessageRow[] => {
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
            const starred = Array.isArray(msg.labelIds) ? msg.labelIds.includes("STARRED") : false;
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
              starred,
              tracked: false,
            } as MessageRow;
          });
        };

        // Cached per (owner+account, mailbox+label+search): a later page for the same view only
        // fetches the incremental window (via Gmail's pageToken) instead of redoing everything
        // already fetched for earlier pages of this view. See messageListCache.ts.
        const cacheSubKey = `${mailbox}::${labelIdFilter}::${effectiveSearch}`;
        const bucket = getAccountBucket(account.ownerUserId, tokenAccountEmail);
        const lockKey = `${account.ownerUserId}::${tokenAccountEmail.toLowerCase()}::${cacheSubKey}`;
        // Only set for a simple, single-label view — see historyLabelIdFor. Everything else
        // (search, custom label, "archive"/"allmail"/"scheduled") always takes the full path.
        const syncLabelId = historyLabelIdFor(mailbox, labelIdFilter, effectiveSearch);

        const loadAccountMessages = async (accessToken: string) => {
          const cached = getStaleCacheEntry<MessageRow>(bucket, cacheSubKey);
          const isFresh = !!cached && cached.expiresAt > Date.now();
          let entry: CacheEntry<MessageRow> = isFresh ? (cached as CacheEntry<MessageRow>) : freshCacheEntry<MessageRow>();

          if (!isFresh || (entry.rows.length < maxResults && !entry.exhausted)) {
            // Serialized: a concurrent request for this same view (e.g. quick back/forward paging)
            // must see this request's progress rather than growing the same entry independently —
            // see withListLock in messageListCache.ts.
            entry = await withListLock(lockKey, async () => {
              // Re-read: the lock may have queued behind a request that already refreshed this
              // entry far enough, in which case there's nothing left to do.
              const recheck = getStaleCacheEntry<MessageRow>(bucket, cacheSubKey);
              let current: CacheEntry<MessageRow>;
              if (recheck && recheck.expiresAt > Date.now()) {
                current = recheck;
              } else {
                // Cheap path: repair the previous rows via Gmail's History API instead of a full
                // list+get, when the stale entry still holds rows and a historyId to diff from.
                // ANY failure (see fetchLabelHistoryDelta) falls straight through to the full
                // refetch below — this is a latency optimization, never a correctness risk.
                const delta =
                  syncLabelId && recheck && recheck.rows.length > 0 && recheck.historyId
                    ? await fetchLabelHistoryDelta(accessToken, recheck.historyId, syncLabelId).catch(() => null)
                    : null;
                if (recheck && delta) {
                  let rows = recheck.rows.filter((row) => !delta.removed.has(row.id));
                  const existingIds = new Set(rows.map((row) => row.id));
                  const newIds = [...delta.added].filter((id) => !existingIds.has(id));
                  if (newIds.length > 0) {
                    const detailed = await mapInBatches(newIds, (id) => fetchGmailMessage(accessToken, id), MESSAGE_DETAIL_CONCURRENCY);
                    rows = [...mapDetailedMessages(detailed), ...rows].sort((a, b) => b.timestamp - a.timestamp);
                  }
                  current = {
                    rows,
                    nextPageToken: recheck.nextPageToken,
                    exhausted: recheck.exhausted,
                    expiresAt: 0,
                    historyId: delta.historyId,
                  };
                } else {
                  current = freshCacheEntry<MessageRow>();
                }
              }

              const seenIds = new Set(current.rows.map((row) => row.id));
              while (current.rows.length < maxResults && !current.exhausted) {
                const needed = maxResults - current.rows.length;
                const list = await fetchGmailList(accessToken, mailbox, needed, effectiveSearch, labelIdFilter, current.nextPageToken);
                current.nextPageToken = list.nextPageToken;
                if (!list.nextPageToken) current.exhausted = true;
                // Gmail's pageToken pagination isn't guaranteed stable if the mailbox changes
                // between pages, which can hand back an id this entry already has — drop it rather
                // than let a duplicate corrupt the merged/sorted list downstream.
                const ids = (list.messages || []).map((m) => m.id).filter((id) => id && !seenIds.has(id));
                if (ids.length === 0) {
                  if (!list.nextPageToken) break;
                  continue;
                }

                // Bounded, not all at once — see MESSAGE_DETAIL_CONCURRENCY.
                const detailed = await mapInBatches(ids, (id) => fetchGmailMessage(accessToken, id), MESSAGE_DETAIL_CONCURRENCY);
                for (const row of mapDetailedMessages(detailed)) {
                  seenIds.add(row.id);
                  current.rows.push(row);
                }
              }
              // First full fetch for a repairable view: establish the historyId baseline a later
              // request can diff against. Best-effort — a failure here just means the next stale
              // read falls back to a full refetch instead of a repair, exactly like today.
              if (syncLabelId && !current.historyId) {
                current.historyId = (await fetchMailboxHistoryId(accessToken).catch(() => null)) || undefined;
              }
              putCacheEntry(bucket, cacheSubKey, current);
              return current;
            });
          }
          accountHasMore.push(!entry.exhausted);
          return entry.rows.slice(0, maxResults);
        };

        try {
          return await loadAccountMessages(tokenResult.accessToken);
        } catch (error) {
          if (!isAuthFailure(error)) throw error;
          const refreshResult = await getValidGmailAccessToken(account.ownerUserId, tokenAccountEmail, { forceRefresh: true });
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
    // Resolve account_ids for selected emails when filtering
    let selectedAccountIds: string[] = [];
    if (selectedEmails.length > 0) {
      const acctRecords = await prisma.emailProviderAccount.findMany({
        where: { user_id: userId, account_email: { in: selectedEmails } },
        select: { id: true },
      });
      selectedAccountIds = acctRecords.map((r) => r.id);
    }

    const composeDraftRows = await prisma.emailComposeDraft.findMany({
      where: {
        user_id: userId,
        ...(selectedAccountIds.length
          ? {
              OR: [
                { account_id: null },
                { account_id: { in: selectedAccountIds } },
              ],
            }
          : {}),
      },
      include: {
        email_provider_accounts: { select: { account_email: true } },
      },
      orderBy: { updated_at: "desc" },
    });
    const mappedDrafts: MessageRow[] = composeDraftRows.map((draft) => {
      const accountEmail = (
        draft.email_provider_accounts?.account_email ||
        selectedEmails[0] ||
        accountRows[0]?.email ||
        ""
      ).toLowerCase();
      const timestamp = draft.updated_at.getTime();
      const recipientLabel =
        firstRecipient(draft.to_text || "") || firstRecipient(draft.cc_text || "") || firstRecipient(draft.bcc_text || "");
      return {
        id: `draftdb:${draft.id}`,
        threadId: draft.thread_id || "",
        accountEmail,
        subject: decodeHtmlEntities(draft.subject || "(No Subject)"),
        from: recipientLabel || "(Draft)",
        to: decodeHtmlEntities(draft.to_text || ""),
        fromRaw: decodeHtmlEntities(draft.to_text || ""),
        toRaw: decodeHtmlEntities(draft.to_text || ""),
        date: draft.updated_at.toUTCString(),
        timestamp,
        snippet: decodeHtmlEntities((draft.body_text || "").slice(0, 220)),
        mailbox: "drafts",
        replyTo: "",
        messageIdHeader: draft.in_reply_to || "",
        references: draft.references || "",
        unread: false,
        tracked: false,
        isComposeDraft: true,
        draftKey: draft.draft_key,
        composeCc: draft.cc_text || "",
        composeBcc: draft.bcc_text || "",
        composeShowCc: Boolean(draft.show_cc),
        composeShowBcc: Boolean(draft.show_bcc),
        composeBodyText: draft.body_text || "",
        composeBodyHtml: draft.body_html || "",
        composePreviewHtml: draft.preview_html || "",
      };
    });
    mergedMessages = [...mappedDrafts, ...mergedMessages].sort((a, b) => b.timestamp - a.timestamp);
  }
  const offset = (page - 1) * pageSize;
  // Don't serve past the fetch window — beyond it the slice would be an incorrect cross-account
  // subset (messages silently dropped/reordered) rather than the true global order.
  const pageMessages = offset >= MAX_FETCH ? [] : mergedMessages.slice(offset, Math.min(offset + pageSize, MAX_FETCH));

  // Tracking rows for a granted (shared) mailbox belong to the OWNER, not the requester — scope
  // by every accessible account's ownerUserId so shared-inbox stats show up.
  const ownerUserIds = [...new Set(accessibleAccounts.map((a) => a.ownerUserId))];

  const trackedRows = await prisma.emailOutboundMessage.findMany({
    where: {
      user_id: { in: ownerUserIds },
      tracking_enabled: true,
      gmail_message_id: { in: pageMessages.map((message) => message.id) },
    },
    select: {
      gmail_message_id: true,
      email_tracking_events: {
        where: { event_type: { in: ["OPEN", "CLICK"] } },
        select: {
          event_type: true,
          occurred_at: true,
        },
        orderBy: { occurred_at: "asc" },
      },
    },
  });

  // Key stats by the globally-unique Gmail message id — no account_id→email mapping needed.
  // (That mapping failed for Gmail/OAuth accounts, which have no provider-account row, so the
  // "opened" dot never showed for them.)
  const trackedStatsByKey = new Map<
    string,
    { openCount: number; clickCount: number; firstOpenedAt: string | null; lastOpenedAt: string | null; totalOpenWindowMs: number }
  >();
  for (const row of trackedRows) {
    if (!row.gmail_message_id) continue;
    const key = String(row.gmail_message_id);
    let openCount = 0;
    let clickCount = 0;
    let firstOpenedAt: Date | null = null;
    let lastOpenedAt: Date | null = null;
    const openTimestamps: number[] = [];
    for (const event of row.email_tracking_events) {
      if (event.event_type === "OPEN") {
        openCount += 1;
        openTimestamps.push(event.occurred_at.getTime());
        if (!firstOpenedAt || event.occurred_at < firstOpenedAt) {
          firstOpenedAt = event.occurred_at;
        }
        if (!lastOpenedAt || event.occurred_at > lastOpenedAt) {
          lastOpenedAt = event.occurred_at;
        }
      } else if (event.event_type === "CLICK") {
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
    tracked: trackedStatsByKey.has(message.id),
    trackingOpenCount: trackedStatsByKey.get(message.id)?.openCount || 0,
    trackingClickCount: trackedStatsByKey.get(message.id)?.clickCount || 0,
    trackingFirstOpenedAt: trackedStatsByKey.get(message.id)?.firstOpenedAt || null,
    trackingLastOpenedAt: trackedStatsByKey.get(message.id)?.lastOpenedAt || null,
    trackingTotalOpenWindowMs: trackedStatsByKey.get(message.id)?.totalOpenWindowMs || 0,
  }));
  const hasNextPage =
    offset + pageSize < MAX_FETCH && (mergedMessages.length > offset + pageSize || accountHasMore.some(Boolean));

  res.status(200).json({
    mailbox,
    messages,
    accountErrors,
    page,
    pageSize,
    totalLoaded: mergedMessages.length,
    hasNextPage,
  });
}, { methods: ["GET"] });
