import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function tokenIsValid(accessToken: string) {
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!r.ok) return false;
    const j = await r.json() as { scope?: string };
    return (j.scope ?? "").includes("https://www.googleapis.com/auth/adwords");
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

  // Onboarding status (no login): ?session=<OnboardingSession.id>
  const sessionId = asStr(req.query.session);
  if (sessionId) {
    try {
      const row = await prisma.onboardingPlatformToken.findUnique({
        where: { sessionId_platform: { sessionId, platform: "googleads" as any } },
        select: { accessToken: true },
      });
      if (!row) { res.status(200).json({ connected: false }); return; }

      const token = decrypt(row.accessToken);
      const connected = await tokenIsValid(token);
      res.status(200).json({ connected });
      return;
    } catch (e) {
      console.error("googleads onboarding status error", e);
      res.status(200).json({ connected: false });
      return;
    }
  }

  // Logged-in connect status
  const session = await getServerSession(req, res, authOptions);
  if (!session) { res.status(401).json({ connected: false }); return; }

  const userId = Number((session.user as any).id);
  try {
    const row = await prisma.userToken.findUnique({
      where: { userId_platform: { userId, platform: "googleads" as any } },
      select: { accessToken: true },
    });
    if (!row) { res.status(200).json({ connected: false }); return; }

    const token = decrypt(row.accessToken);
    const connected = await tokenIsValid(token);
    res.status(200).json({ connected });
  } catch (e) {
    console.error("googleads status error", e);
    res.status(200).json({ connected: false });
  }
}
