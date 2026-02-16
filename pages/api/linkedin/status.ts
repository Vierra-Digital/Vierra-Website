import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { requireSession } from "@/lib/auth";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function linkedinTokenIsValid(token: string) {
  try {
    const r1 = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r1.ok) return true;
    const r2 = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r2.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }
  const sessionId = asStr(req.query.session);
  if (sessionId) {
    try {
      const row = await prisma.onboardingPlatformToken.findUnique({
        where: { sessionId_platform: { sessionId, platform: "linkedin" } as any },
        select: { accessToken: true },
      });
      if (!row) {
        res.status(200).json({ connected: false });
        return;
      }
      const token = decrypt(row.accessToken);
      const connected = await linkedinTokenIsValid(token);
      res.status(200).json({ connected });
      return;
    } catch (e) {
      console.error("linkedin onboarding status error", e);
      res.status(200).json({ connected: false });
      return;
    }
  }
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ connected: false });
    return;
  }

  const userId = Number((session.user as any).id);
  try {
    const row = await prisma.userToken.findUnique({
      where: { userId_platform: { userId, platform: "linkedin" } as any },
      select: { accessToken: true },
    });
    if (!row) {
      res.status(200).json({ connected: false });
      return;
    }

    const token = decrypt(row.accessToken);
    const connected = await linkedinTokenIsValid(token);
    res.status(200).json({ connected });
  } catch (e) {
    console.error("linkedin status error", e);
    res.status(200).json({ connected: false });
  }
}
