import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/api/withAuth";
import { senderAvatarSources } from "@/lib/email/senderAvatar";

/**
 * One image URL per sender, for the message list.
 *
 * The list needs an avatar for every visible row, which rules out the reader's approach: that one
 * resolves contact photos through the People API, far too expensive to run per row. This serves the
 * sources that need no per-user lookup — Gravatar, then the sending domain's favicon — and proxies
 * whichever exists so the browser gets a single cacheable URL that either returns an image or 204s.
 *
 * Proxying rather than redirecting is deliberate: Gravatar and Google's favicon service both key off
 * the referrer, and a 302 to them from our page sends one. Fetching server-side sends none.
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ENTRIES = 1_000;
/** Favicons and Gravatars are small; anything larger is not an avatar and is not worth proxying. */
const MAX_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 4_000;

type Entry = { body: Buffer | null; contentType: string; expiresAt: number };
const cache = new Map<string, Entry>();

/**
 * In-flight requests per sender. A mailbox page usually contains several messages from the same
 * person, so without this the same upstream avatar would be fetched once per row.
 */
const inFlight = new Map<string, Promise<{ body: Buffer; contentType: string; kind: string } | null>>();

function readCache(key: string, now: number): Entry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function writeCache(key: string, entry: Omit<Entry, "expiresAt">, now: number): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { ...entry, expiresAt: now + CACHE_TTL_MS });
}

/** Fetch a candidate, returning null unless it is an image small enough to be an avatar. */
async function fetchImage(url: string): Promise<{ body: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;
    return { body: buffer, contentType };
  } catch {
    // Timeout, DNS failure, offline host: treat as "no avatar here" and try the next candidate.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default withAuth(async (req, res: NextApiResponse) => {
  const email = String((req as NextApiRequest).query.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    res.status(400).end();
    return;
  }

  const now = Date.now();
  const cached = readCache(email, now);
  if (cached) {
    // A cached miss is served as 204 as well, so a sender with no avatar costs nothing to re-ask.
    if (!cached.body) {
      res.status(204).end();
      return;
    }
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Cache-Control", "private, max-age=43200");
    res.status(200).send(cached.body);
    return;
  }

  const pending =
    inFlight.get(email) ??
    (async () => {
      // Contact photos are the reader's job; here only the sources that need no per-user lookup.
      const candidates = senderAvatarSources(email).filter((source) => !source.url.startsWith("data:"));
      // Concurrently, then chosen by priority rather than by whichever answered first: a sender with
      // no avatar anywhere is the common case, and trying each source in turn made that the slowest.
      const settled = await Promise.all(
        candidates.map(async (candidate) => {
          const image = await fetchImage(candidate.url);
          return image ? { ...image, kind: candidate.kind } : null;
        })
      );
      return settled.find(Boolean) ?? null;
    })();
  inFlight.set(email, pending);

  let image: Awaited<typeof pending>;
  try {
    image = await pending;
  } finally {
    inFlight.delete(email);
  }

  if (!image) {
    writeCache(email, { body: null, contentType: "" }, now);
    res.status(204).end();
    return;
  }

  writeCache(email, { body: image.body, contentType: image.contentType }, now);
  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "private, max-age=43200");
  res.setHeader("X-Avatar-Kind", image.kind);
  res.status(200).send(image.body);
});
