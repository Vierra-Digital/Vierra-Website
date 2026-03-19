import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const userId = Number((session.user as any).id);
  const accountEmail = asStr(req.query.accountEmail).trim().toLowerCase();
  const from = asStr(req.query.from).trim();
  const to = asStr(req.query.to).trim();

  const where: any = { userId };
  if (accountEmail) where.accountEmail = accountEmail;
  if (from || to) {
    where.createdAt = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  const messages = await prisma.emailOutboundMessage.findMany({
    where,
    select: {
      id: true,
      gmailMessageId: true,
      accountEmail: true,
      subject: true,
      trackingEnabled: true,
      createdAt: true,
      trackingEvents: {
        select: {
          eventType: true,
          occurredAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = messages.map((message) => {
    const openCount = message.trackingEvents.filter((event) => event.eventType === "OPEN").length;
    const clickCount = message.trackingEvents.filter((event) => event.eventType === "CLICK").length;
    return {
      messageId: message.gmailMessageId,
      accountEmail: message.accountEmail,
      subject: message.subject,
      trackingEnabled: message.trackingEnabled,
      createdAt: message.createdAt,
      openCount,
      clickCount,
    };
  });

  res.status(200).json({
    totals: {
      trackedMessages: rows.filter((row) => row.trackingEnabled).length,
      opens: rows.reduce((sum, row) => sum + row.openCount, 0),
      clicks: rows.reduce((sum, row) => sum + row.clickCount, 0),
    },
    messages: rows,
  });
}
