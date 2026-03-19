import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";

type GmailConnection = {
  email: string;
  connected: boolean;
  expiresAt: string | null;
  reconnectReason: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ connected: false, accounts: [] });
    return;
  }

  const userId = Number((session.user as any).id);
  try {
    const rows = await prisma.userToken.findMany({
      where: { userId, platform: { startsWith: "gmail:" } },
      select: { platform: true, accessToken: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const accounts: GmailConnection[] = await Promise.all(
      rows.map(async (row) => {
        const email = row.platform.replace(/^gmail:/, "");
        const tokenResult = await getValidGmailAccessToken(userId, email);
        const connected = tokenResult.ok;
        return {
          email,
          connected,
          expiresAt:
            tokenResult.ok && tokenResult.expiresAt
              ? tokenResult.expiresAt.toISOString()
              : row.expiresAt
                ? row.expiresAt.toISOString()
                : null,
          reconnectReason: tokenResult.ok ? null : tokenResult.reason,
        };
      })
    );

    res.status(200).json({
      connected: accounts.some((a) => a.connected),
      accounts,
    });
  } catch (e) {
    console.error("gmail status error", e);
    res.status(200).json({ connected: false, accounts: [] });
  }
}
