import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
async function isFbTokenValid(token: string) {
  const appToken = `${process.env.FACEBOOK_CLIENT_ID}|${process.env.FACEBOOK_CLIENT_SECRET}`;
  const url = new URL("https://graph.facebook.com/v23.0/debug_token");
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", appToken);

  try {
    const r = await fetch(url.toString());
    if (!r.ok) return false;
    const j = await r.json();
    return !!j?.data?.is_valid;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });
  const sessionId = asStr(req.query.session);
  if (sessionId) {
    try {
      const row = await prisma.onboardingPlatformToken.findUnique({
        where: { session_id_platform: { session_id: sessionId, platform: "facebook" } },
        select: { access_token: true },
      });
      if (!row) return res.status(200).json({ connected: false });

      const token = decrypt(row.access_token);
      const connected = await isFbTokenValid(token);
      return res.status(200).json({ connected });
    } catch (e) {
      console.error("FB onboarding status error", e);
      return res.status(200).json({ connected: false });
    }
  }
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ connected: false });

  const userId = (session.user as any).id;
  try {
    const row = await prisma.platformToken.findUnique({
      where: { user_id_platform: { user_id: userId, platform: "facebook" } },
      select: { access_token: true },
    });
    if (!row) return res.status(200).json({ connected: false });

    const token = decrypt(row.access_token);
    const connected = await isFbTokenValid(token);
    return res.status(200).json({ connected });
  } catch (e) {
    console.error("FB status error", e);
    return res.status(200).json({ connected: false });
  }
}
