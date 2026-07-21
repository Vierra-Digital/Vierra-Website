import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { applyExtensionCors, resolveExtensionUser } from "@/lib/linkedin/extensionAuth";

/**
 * The extension polls this to fetch pending outbound LinkedIn messages (replies composed
 * in the panel) that it should send on linkedin.com. Scoped to the token's user.
 *
 * GET → { commands: [{ id, liThreadId, body, createdAt }] }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyExtensionCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const auth = await resolveExtensionUser(req);
  if (!auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const commands = await prisma.linkedInSendCommand.findMany({
      where: { user_id: auth.userId, status: "PENDING" },
      orderBy: { created_at: "asc" },
      take: 25,
      select: { id: true, li_thread_id: true, body: true, created_at: true },
    });
    res.status(200).json({
      commands: commands.map((c) => ({
        id: c.id,
        liThreadId: c.li_thread_id,
        body: c.body,
        createdAt: c.created_at.toISOString(),
      })),
    });
  } catch (e) {
    console.error("extension/linkedin/commands error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
