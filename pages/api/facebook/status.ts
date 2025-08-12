import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Platform } from "@prisma/client";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Use app token to validate user token
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

  // If ?session is present -> ONBOARDING status (no login required)
  const sessionId = asStr(req.query.session);
  if (sessionId) {
    try {
      const row = await prisma.onboardingPlatformToken.findUnique({
        where: { sessionId_platform: { sessionId, platform: Platform.facebook } },
        select: { accessToken: true },
      });
      if (!row) return res.status(200).json({ connected: false });

      const token = decrypt(row.accessToken);
      const connected = await isFbTokenValid(token);
      return res.status(200).json({ connected });
    } catch (e) {
      console.error("FB onboarding status error", e);
      return res.status(200).json({ connected: false });
    }
  }

  // Otherwise -> LOGGED-IN Connect status
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ connected: false });

  const userId = Number((session.user as any).id);
  try {
    const row = await prisma.userToken.findUnique({
      where: { userId_platform: { userId, platform: Platform.facebook } },
      select: { accessToken: true },
    });
    if (!row) return res.status(200).json({ connected: false });

    const token = decrypt(row.accessToken);
    const connected = await isFbTokenValid(token);
    return res.status(200).json({ connected });
  } catch (e) {
    console.error("FB status error", e);
    return res.status(200).json({ connected: false });
  }
}
