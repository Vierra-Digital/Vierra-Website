import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function getId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);
  const id = getId(req);
  if (!id) {
    res.status(400).json({ message: "Contact id is required." });
    return;
  }

  const existing = await prisma.contact.findFirst({
    where: { id, userId },
    include: {
      tags: {
        include: { tag: true },
      },
    },
  });
  if (!existing) {
    res.status(404).json({ message: "Contact not found." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      contact: {
        ...existing,
        tags: existing.tags.map((assignment) => assignment.tag),
      },
    });
    return;
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const updated = await prisma.contact.update({
      where: { id },
      data: {
        firstName: req.body?.firstName !== undefined ? asStr(req.body?.firstName) || null : existing.firstName,
        lastName: req.body?.lastName !== undefined ? asStr(req.body?.lastName) || null : existing.lastName,
        email: req.body?.email !== undefined ? asStr(req.body?.email).toLowerCase() || existing.email : existing.email,
        phone: req.body?.phone !== undefined ? asStr(req.body?.phone) || null : existing.phone,
        business: req.body?.business !== undefined ? asStr(req.body?.business) || null : existing.business,
        website: req.body?.website !== undefined ? asStr(req.body?.website) || null : existing.website,
        address: req.body?.address !== undefined ? asStr(req.body?.address) || null : existing.address,
      },
    });
    await syncContactsSpreadsheetForUser({ userId });
    res.status(200).json({ contact: updated });
    return;
  }

  if (req.method === "DELETE") {
    await prisma.contact.delete({ where: { id } });
    await syncContactsSpreadsheetForUser({ userId });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
