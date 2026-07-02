/**
 * Minimal in-memory rate limiter for API routes on serverless/Netlify Functions.
 *
 * Caveat: state lives in the function's memory, which is per-instance and reset
 * on cold start — under concurrent/scaled instances this is a soft limit, not a
 * hard guarantee. It still meaningfully raises the bar against unsophisticated
 * bots hitting a warm instance repeatedly, with zero added infrastructure. For a
 * hard guarantee, back this with Upstash/Redis or a Netlify Rate Limiting rule.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Returns true if the call is allowed under `limit` requests per `windowMs`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic cleanup so `buckets` doesn't grow unbounded in a long-lived
  // warm instance; cheap enough to run on a small fraction of calls.
  if (Math.random() < 0.02) {
    for (const [k, b] of buckets) {
      if (now > b.resetAt) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Best-effort client IP from standard proxy headers (Netlify/Vercel/generic). */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff;
  if (first) return first.split(",")[0].trim();

  const nfIp = req.headers["x-nf-client-connection-ip"];
  if (typeof nfIp === "string" && nfIp) return nfIp;

  return req.socket?.remoteAddress || "unknown";
}
