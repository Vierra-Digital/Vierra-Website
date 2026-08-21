// Short-lived, per-process cache of a mailbox account's badge counts (unread inbox/spam/starred,
// draft total). /api/gmail/counts is the most frequently re-triggered retrieval call in the panel
// — nearly every action (archive, label, snooze, delete, mark read...) calls loadMailboxCounts()
// afterward, and each call previously did 4 live Gmail labels.get requests PER connected account
// with no caching at all, unlike the message list (see messageListCache.ts). A short TTL absorbs
// rapid repeat calls (e.g. two actions fired back to back) without showing badges that are stale
// by more than a few seconds.
const COUNTS_CACHE_TTL_MS = 20_000;

export type MailboxCounts = {
  inbox: number;
  sent: number;
  drafts: number;
  spam: number;
  trash: number;
  archive: number;
  starred: number;
};

type Entry = { data: MailboxCounts; expiresAt: number };

const cache = new Map<string, Entry>();

// A send-as alias shares its parent account's mailbox but has its own (approximate, search-based)
// counts, so it needs its own cache entry distinct from the parent's exact labels.get counts.
function cacheKey(ownerUserId: string, tokenAccountEmail: string, aliasEmail?: string) {
  const base = `${ownerUserId}::${tokenAccountEmail.toLowerCase()}`;
  return aliasEmail ? `${base}::alias:${aliasEmail.toLowerCase()}` : base;
}

export function getCachedCounts(
  ownerUserId: string,
  tokenAccountEmail: string,
  aliasEmail?: string
): MailboxCounts | undefined {
  const key = cacheKey(ownerUserId, tokenAccountEmail, aliasEmail);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

export function putCachedCounts(
  ownerUserId: string,
  tokenAccountEmail: string,
  data: MailboxCounts,
  aliasEmail?: string
) {
  cache.set(cacheKey(ownerUserId, tokenAccountEmail, aliasEmail), {
    data,
    expiresAt: Date.now() + COUNTS_CACHE_TTL_MS,
  });
}

/**
 * Drop every cached counts entry (the account's own, and any alias entries riding on its
 * mailbox) for one account — called alongside invalidateGmailListCache wherever an action
 * changes read state (archive/label/star/mark read/delete/...), so badges reflect it on the
 * next load instead of serving a stale snapshot for up to COUNTS_CACHE_TTL_MS.
 */
export function invalidateGmailCountsCache(ownerUserId: string, tokenAccountEmail: string) {
  const prefix = cacheKey(ownerUserId, tokenAccountEmail);
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}::alias:`)) cache.delete(key);
  }
}
