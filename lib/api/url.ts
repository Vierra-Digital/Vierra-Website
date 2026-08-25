import type { NextApiRequest } from "next";

export function resolveBaseUrl(req: NextApiRequest): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const host = req.headers.host || "vierradev.com";
  return `${proto || "https"}://${host}`.replace(/\/+$/, "");
}

/**
 * Rebuild a caller-supplied link on our own base, keeping only its path and query.
 *
 * Anything an outside caller puts in a link that we then email out is a phishing vector: an
 * absolute off-site URL would otherwise be sent inside our own branded template, from our own
 * address. Dropping the origin makes that impossible by construction rather than by validation.
 *
 * Rebuilding rather than rejecting an off-origin link is deliberate — the panel sends
 * window.location.origin, which legitimately differs from the configured base on www and on deploy
 * previews, so comparing origins would reject genuine requests.
 *
 * Returns null when the input cannot be parsed as a URL at all.
 */
export function toSameSiteUrl(link: string, base: string): string | null {
  try {
    const resolved = new URL(link, base);
    return new URL(`${resolved.pathname}${resolved.search}`, base).toString();
  } catch {
    return null;
  }
}

/**
 * Base URL for cron/webhook handlers that build tracking + deep-link URLs. Prefers the public
 * site env (NEXT_PUBLIC_SITE_URL / APP_URL), else the forwarded request host. Kept separate from
 * resolveBaseUrl above, which uses NEXT_PUBLIC_APP_URL.
 */
export function resolveCronBaseUrl(req: NextApiRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000");
  return `${proto}://${host}`.replace(/\/$/, "");
}

