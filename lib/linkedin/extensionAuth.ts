import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Per-user auth for the Vierra Sales Nav extension. Unlike the shared-secret
 * `/api/extension/track` endpoint, LinkedIn sync is per-user (staff sync their own
 * LinkedIn, clients theirs), so each user mints their own `extension_token` in
 * Settings and the extension sends it as a Bearer token.
 */
export function applyExtensionCors(res: NextApiResponse) {
  // Guarded by the per-user token, so a permissive origin is acceptable.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

/** Resolve the user_id owning a per-user extension token (Bearer). Null if invalid/missing. */
export async function resolveExtensionUser(req: NextApiRequest): Promise<{ userId: string } | null> {
  const provided = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided.length < 24) return null;
  const user = await prisma.user.findUnique({
    where: { extension_token: provided },
    select: { id: true },
  });
  return user ? { userId: user.id } : null;
}
