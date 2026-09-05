# Gmail cache: move to shared Redis (Upstash)

## Problem

`lib/gmail/messageListCache.ts` and `lib/gmail/countsCache.ts` are in-memory
(`Map`) caches, TTL 90s and 20s respectively. They were built to stop
`/api/gmail/messages` from redoing every earlier page's Gmail List + per-message
Get calls on each new page, and to stop `/api/gmail/counts` from firing 4 live
`labels.get` calls per account on every action.

The app deploys to Netlify via `@netlify/plugin-nextjs`, which runs API routes
as AWS Lambda functions (confirmed in `netlify.toml`; edge runtime was dropped
in 6f92ae5). A `Map` in module scope only survives on a warm container reused
for a later invocation. Under real concurrency Lambda spins up parallel
containers, and any cold start begins empty, so the cache's actual hit rate in
production is far below what local testing shows — most requests still pay
the full live Gmail fan-out. Moving the cache to Upstash Redis (HTTP-based,
no persistent connection needed, fits Lambda) makes a cache entry visible to
every container instead of one.

This keeps the existing design (TTL entries, History-API delta repair,
per-view locking, targeted invalidation on mutating actions) — it swaps the
storage backend, not the caching strategy.

## Scope

In: `lib/gmail/messageListCache.ts`, `lib/gmail/countsCache.ts`, their callers
(`pages/api/gmail/messages.ts`, `pages/api/gmail/counts.ts`,
`pages/api/gmail/actions.ts`, `pages/api/gmail/apply-label.ts`,
`lib/gmail/snooze.ts`), one new dependency (`@upstash/redis`), two new env
vars.

Out: the structural fix (a DB mirror of messages kept live via Gmail push,
serving reads without calling Gmail at all) — bigger, separate piece of work,
not this doc.

## Backend: Upstash Redis

- REST/HTTP client (`@upstash/redis`) — no TCP connection pooling problem in
  Lambda, unlike ioredis/node-redis.
- Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Added to
  `.env.example`.
- Free tier covers this comfortably: entries are small (a page of message
  metadata, or a counts object), TTLs are short (20-90s), so steady-state key
  count and storage stay low regardless of traffic.

## Key scheme

Same identity the current code keys on, flattened into Redis key strings instead
of nested `Map`s:

```
gmail:list:{ownerUserId}:{tokenAccountEmail}:{mailbox}::{labelIdFilter}::{search}
gmail:counts:{ownerUserId}:{tokenAccountEmail}[:alias:{aliasEmail}]
gmail:lock:{ownerUserId}:{tokenAccountEmail}:{mailbox}::{labelIdFilter}::{search}
```

Lowercase the email segments, as the current code already does via
`accountKey`/`cacheKey`. Values are JSON-serialized `CacheEntry<T>` /
`MailboxCounts`.

## API changes (mechanical, same call shapes)

`messageListCache.ts` and `countsCache.ts` keep their exported function
names and signatures but become `async`, backed by Redis `GET`/`SET`/`DEL`
instead of `Map` reads/writes:

- `getCacheEntry` / `getStaleCacheEntry` → `redis.get(key)`, JSON-parsed.
  `getCacheEntry`'s "expired → delete and return undefined" behavior is
  redundant once entries carry a Redis `EX` TTL (Redis expires them itself);
  keep the `expiresAt` field for the freshness *check* messages.ts already
  does (`cached.expiresAt > Date.now()`), just drop the manual delete.
- `putCacheEntry` → `redis.set(key, JSON.stringify(entry), { ex: CACHE_TTL_MS / 1000 })`.
- `invalidateGmailListCache` → currently deletes one bucket (every
  mailbox/label/search view for an account) via `buckets.delete(accountKey)`.
  Redis has no equivalent of "delete this Map". Replace the single-key
  `Map` bucket with a per-view Redis key plus a Redis `SET` of that
  account's known view sub-keys (`gmail:list:keys:{account}`), so
  invalidation becomes: read the member list, `DEL` each view key, `DEL` the
  member-list key. `putCacheEntry` adds its sub-key to that member set
  (`SADD`, same TTL) whenever it writes a view.
- `getCachedCounts` / `putCachedCounts` → same `GET`/`SET` swap, no bucket
  concept to replicate (already one key per account+alias).
- `invalidateGmailCountsCache` → currently a `keys.startsWith(prefix)` scan
  over a small in-process `Map`. Redis has no cheap prefix scan on Upstash's
  free tier (`KEYS`/`SCAN` works but is discouraged at any real key count).
  Since the alias set for an account is small and known at invalidation time
  (same accounts the caller already resolved via `getGmailAliasAccounts`),
  pass the alias emails through so invalidation can `DEL` exact keys instead
  of scanning. Callers (`actions.ts`, `apply-label.ts`, `snooze.ts`) already
  have `account`/`owner` context in scope — check whether alias emails are
  reachable there without an extra query; if not, accept a small widening
  (alias counts entries expire on their own 20s TTL regardless, so a missed
  alias invalidation is a bounded staleness, not a correctness bug).

## Locking (`withListLock`)

Current `withListLock` uses an in-process `Map<string, Promise>` to serialize
concurrent growth of the same cache entry (prevents duplicate messages when
two requests race on the same pageToken). That specific race only matters
*within* one container — two Lambda invocations on different containers
racing the same key isn't newly introduced by this change and isn't newly
solved by it either (true cross-container locking would need Redis `SETNX`
with a lease/expiry and retry, which is more moving parts for a race that's
rare and self-heals: the merge-and-slice in `messages.ts` re-sorts and the
90s TTL bounds how long a duplicate survives).

Decision: leave `withListLock` as in-process for this change. Cross-container
locking is a follow-up if duplicates turn out to be observable in practice,
not a blocker for shipping the shared cache.

## Failure handling

Upstash being unreachable/erroring must degrade to "no cache," never break
the mailbox. Wrap every Redis call so a failure returns `undefined`/does
nothing (`.catch(() => undefined)`), matching the existing pattern in
`messages.ts` where `fetchLabelHistoryDelta` failures already fall through to
a full refetch — same posture, just at the storage layer instead of the
history-repair layer.

## Call-site changes

`getCacheEntry`, `getStaleCacheEntry`, `putCacheEntry`,
`invalidateGmailListCache`, `getCachedCounts`, `putCachedCounts`,
`invalidateGmailCountsCache` all become `async`. Every call site needs
`await`:

- `pages/api/gmail/messages.ts` — heaviest caller, already inside async
  functions throughout, so this is `await` insertion, not restructuring.
- `pages/api/gmail/counts.ts` — same.
- `pages/api/gmail/actions.ts`, `pages/api/gmail/apply-label.ts`,
  `lib/gmail/snooze.ts` — invalidation calls, currently fire-and-forget
  synchronous calls; decide whether these should be awaited (safer — next
  read is guaranteed to see the invalidation) or fired without awaiting
  (faster response to the action, tiny window where a near-simultaneous read
  could see stale data). Recommend awaiting: these are already inside
  request handlers doing a Gmail mutation call, so one more awaited Redis
  round-trip is not the bottleneck, and it removes a race that fire-and-forget
  would introduce that doesn't exist today.

## Rollout

1. Add `@upstash/redis`, env vars, provision the Upstash database (or confirm
   the user wants to do this manually and just needs the code to point at it).
2. Land the storage-layer swap behind the same function names so the diff in
   the five call sites is mechanical (`await` insertions), reviewable
   independently of the Redis-specific plumbing in the two cache modules.
3. Verify in a deploy preview: repeated mailbox loads across enough requests
   to force multiple Lambda containers (not just local `next dev`, which is
   one process and would show a hit rate that doesn't reflect production).
4. Watch Upstash's request/latency dashboard after the first real day of
   traffic — this is the number that confirms the fix, not local timing.

## Explicit non-goals

- No change to `messages.ts`'s History-API delta-repair logic, mailbox query
  building, or dedupe/collapse logic — only where cache entries are read from
  and written to.
- No cross-container locking for `withListLock` (see above).
- No DB-mirror/push-driven read path (option 4 from the earlier scoping) —
  separate design doc if pursued.
