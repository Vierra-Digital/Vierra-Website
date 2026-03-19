import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  if (req.method === "GET") {
    const accountEmail = asStr(req.query.accountEmail).toLowerCase();
    const rows = await prisma.emailBlockedSender.findMany({
      where: {
        userId,
        ...(accountEmail ? { accountEmail } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ blocked: rows });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const email = asStr(req.body?.email).toLowerCase();
    if (!email) {
      res.status(400).json({ message: "email is required." });
      return;
    }
    const existing = await prisma.emailBlockedSender.findFirst({
      where: { userId, email, ...(accountEmail ? { accountEmail } : { accountEmail: null }) },
      select: { id: true },
    });
    const row = existing
      ? await prisma.emailBlockedSender.update({
          where: { id: existing.id },
          data: { name: asStr(req.body?.name) || null },
        })
      : await prisma.emailBlockedSender.create({
          data: {
            userId,
            accountEmail,
            email,
            name: asStr(req.body?.name) || null,
          },
        });
    res.status(200).json({ blocked: row });
    return;
  }

  if (req.method === "DELETE") {
    const id = asStr(req.body?.id || req.query.id);
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }
    const row = await prisma.emailBlockedSender.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!row) {
      res.status(404).json({ message: "Blocked sender not found." });
      return;
    }
    await prisma.emailBlockedSender.delete({ where: { id } });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}

