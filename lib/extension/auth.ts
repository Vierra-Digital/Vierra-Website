import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Shared auth for the token-authed browser-extension endpoints. The extension
 * runs on linkedin.com and can't use the site's Supabase session cookie, so it
 * authenticates with a shared secret (same env vars as /api/extension/track):
 *
 *   EXTENSION_TRACK_TOKEN       - shared secret sent as a Bearer token
 *   EXTENSION_TRACK_USER_ID     - the user_id these writes belong to
 *   EXTENSION_TRACK_COMPANY_ID  - that user's company_id
 */
export function applyCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

export type ExtensionCtx = { userId: string; companyId: string };

/**
 * Validates the Bearer token and required config. On failure it sends the
 * response (401/500) and returns null — callers should `if (!ctx) return;`.
 */
export function requireExtensionAuth(req: NextApiRequest, res: NextApiResponse): ExtensionCtx | null {
  const expected = (process.env.EXTENSION_TRACK_TOKEN || "").trim();
  const provided = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || provided !== expected) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const userId = (process.env.EXTENSION_TRACK_USER_ID || "").trim();
  const companyId = (process.env.EXTENSION_TRACK_COMPANY_ID || "").trim();
  if (!userId || !companyId) {
    res.status(500).json({ message: "Extension tracking is not configured on the server." });
    return null;
  }
  return { userId, companyId };
}
