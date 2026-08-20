// Short-lived, per-process cache of Gmail list+detail results, keyed per mailbox account.
//
// /api/gmail/messages pages by re-requesting the newest `page * pageSize` messages every time
// (see messages.ts) so the merge-and-slice across accounts stays globally ordered. Without this
// cache that means page 2 redoes ALL of page 1's Gmail List + per-message Get calls before doing
// any new work, and page 3 redoes pages 1 and 2's — the per-page cost (and latency) grows with
// the page number instead of staying flat. This cache lets a request that already covers the
// needed window return instantly, and a request that needs more just fetch the incremental slice
// via Gmail's pageToken instead of starting over.
const CACHE_TTL_MS = 90_000;

export type CacheEntry<T> = {
  rows: T[];
  nextPageToken?: string;
  exhausted: boolean;
  expiresAt: number;
};

type AccountBucket = Map<string, CacheEntry<any>>;

const buckets = new Map<string, AccountBucket>();

function accountKey(ownerUserId: string, tokenAccountEmail: string) {
  return `${ownerUserId}::${tokenAccountEmail.toLowerCase()}`;
}

/** The bucket for one mailbox account, holding one cache entry per (mailbox, label, search) view. */
export function getAccountBucket(ownerUserId: string, tokenAccountEmail: string): AccountBucket {
  const key = accountKey(ownerUserId, tokenAccountEmail);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = new Map();
    buckets.set(key, bucket);
  }
  return bucket;
}

/** Reads a live (non-expired) entry, discarding it first if it has aged out. */
export function getCacheEntry<T>(bucket: AccountBucket, subKey: string): CacheEntry<T> | undefined {
  const entry = bucket.get(subKey);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    bucket.delete(subKey);
    return undefined;
  }
  return entry;
}

export function freshCacheEntry<T>(): CacheEntry<T> {
  return { rows: [], nextPageToken: undefined, exhausted: false, expiresAt: 0 };
}

export function putCacheEntry<T>(bucket: AccountBucket, subKey: string, entry: CacheEntry<T>) {
  entry.expiresAt = Date.now() + CACHE_TTL_MS;
  bucket.set(subKey, entry);
}

/**
 * Drops all cached list windows for one mailbox account (every mailbox/label/search view of it),
 * so an action that changes what's in a mailbox — archive, delete, star, mark read, label — is
 * reflected on next load instead of serving the pre-mutation snapshot for up to CACHE_TTL_MS.
 */
export function invalidateGmailListCache(ownerUserId: string, tokenAccountEmail: string) {
  buckets.delete(accountKey(ownerUserId, tokenAccountEmail));
}

// Serializes growth of one cache entry. Paging back and forth quickly (or a next-page prefetch
// racing a real request) fires several /api/gmail/messages requests for the same account+view
// concurrently. Each one previously read `entry.nextPageToken`, awaited Gmail, then pushed onto
// `entry.rows` independently — two requests that both started from an empty/short entry would
// both continue from the SAME pageToken and both append the same Gmail page, leaving duplicate
// messages in the merged list (visible as React "two children with the same key" warnings and a
// garbled page). Routing every growth step through this lock makes the second request wait for
// the first to finish (and see its progress) instead of racing it.
const locks = new Map<string, Promise<unknown>>();

export function withListLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(lockKey) ?? Promise.resolve();
  const result = prior.then(fn, fn);
  locks.set(lockKey, result.catch(() => {}));
  return result;
}
