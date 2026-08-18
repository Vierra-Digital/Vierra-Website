/**
 * Short-lived cache for resolved sender photo URLs.
 *
 * Looking a sender up costs one or more People API round trips, and the reader cannot respond until
 * they finish. The same handful of senders appear over and over in a mailbox, so without a cache
 * every single open pays that cost again.
 *
 * Misses are cached too — a sender with no discoverable photo is the common case, and re-querying
 * three endpoints on every open just to learn that again is the most expensive possible outcome.
 * Their entries expire sooner, so a photo added later still shows up without a restart.
 */

const HIT_TTL_MS = 12 * 60 * 60 * 1000;
const MISS_TTL_MS = 30 * 60 * 1000;
/** Bounded so a long-running instance can't grow this without limit. */
const MAX_ENTRIES = 2_000;

type Entry = { url: string; expiresAt: number };

const cache = new Map<string, Entry>();

/** Scoped per mailbox: contacts are per-account, so one account's miss must not mask another's hit. */
function cacheKey(accountEmail: string, senderEmail: string): string {
  return `${accountEmail.toLowerCase()}::${senderEmail.toLowerCase()}`;
}

/** The cached URL, `""` for a cached miss, or `undefined` when nothing is cached. */
export function getCachedSenderPhoto(accountEmail: string, senderEmail: string, now: number): string | undefined {
  const key = cacheKey(accountEmail, senderEmail);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.url;
}

export function setCachedSenderPhoto(accountEmail: string, senderEmail: string, url: string, now: number): void {
  if (cache.size >= MAX_ENTRIES) {
    // Insertion-ordered, so this drops the oldest entry.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(cacheKey(accountEmail, senderEmail), {
    url,
    expiresAt: now + (url ? HIT_TTL_MS : MISS_TTL_MS),
  });
}

/** Testing seam. */
export function clearSenderPhotoCache(): void {
  cache.clear();
}
