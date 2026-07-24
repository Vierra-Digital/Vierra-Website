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

