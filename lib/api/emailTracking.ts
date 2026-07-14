import { createHash } from "crypto";
import type { NextApiRequest } from "next";

/**
 * Shared helpers for the email open/click tracking endpoints
 * (pages/api/email/track/{open,click}/[token].ts), which had these
 * byte-identical. Kept in one place so both routes stay in lockstep.
 */

/** First value of a query param (or the value), or "" when absent. */
export function asToken(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v || "";
}

/** SHA-256 of the client IP for privacy-preserving open/click dedupe; null when empty. */
export function hashIp(ip: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/** Client IP: first x-forwarded-for hop, falling back to the socket address. */
export function trackingClientIp(req: NextApiRequest): string {
  return (
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket.remoteAddress ||
    ""
  );
}

function getRequestOrigin(req: NextApiRequest): string {
  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  return host ? `${proto}://${host}` : "";
}

/**
 * True when the request is likely the sender previewing their own message in the
 * panel (same-origin fetch, or a referer under /panel) — so self-triggered opens
 * and clicks aren't counted as recipient engagement.
 */
export function isLikelySelfPreview(req: NextApiRequest): boolean {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "same-origin") return true;

  const referer = String(req.headers.referer || "");
  if (!referer) return false;
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return false;

  try {
    const refererUrl = new URL(referer);
    return refererUrl.origin === requestOrigin && refererUrl.pathname.startsWith("/panel");
  } catch {
    return false;
  }
}
