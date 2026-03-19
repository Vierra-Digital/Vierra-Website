import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function asArray(v: unknown) {
  if (Array.isArray(v)) return v.map((entry) => asStr(entry)).filter(Boolean);
  return [];
}

function getContactId(req: NextApiRequest) {
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
  const contactId = getContactId(req);
  if (!contactId) {
    res.status(400).json({ message: "Contact id is required." });
    return;
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId },
  });
  if (!contact) {
    res.status(404).json({ message: "Contact not found." });
    return;
  }

  if (req.method === "GET") {
    const tags = await prisma.contactTagAssignment.findMany({
      where: { contactId },
      include: { tag: true },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json({ tags: tags.map((row) => row.tag) });
    return;
  }

  if (req.method === "POST") {
    const tagId = asStr(req.body?.tagId);
    if (!tagId) {
      res.status(400).json({ message: "tagId is required" });
      return;
    }
    const tag = await prisma.contactTag.findFirst({ where: { id: tagId, userId } });
    if (!tag) {
      res.status(404).json({ message: "Tag not found." });
      return;
    }
    await prisma.contactTagAssignment.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      update: {},
      create: { contactId, tagId },
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "PUT") {
    const tagIds = asArray(req.body?.tagIds);
    const validTags = await prisma.contactTag.findMany({
      where: { userId, id: { in: tagIds } },
      select: { id: true },
    });
    const validTagIds = validTags.map((tag) => tag.id);

    await prisma.contactTagAssignment.deleteMany({ where: { contactId } });
    if (validTagIds.length > 0) {
      await prisma.contactTagAssignment.createMany({
        data: validTagIds.map((tagId) => ({ contactId, tagId })),
      });
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE") {
    const tagId = asStr(req.body?.tagId);
    if (!tagId) {
      res.status(400).json({ message: "tagId is required" });
      return;
    }
    await prisma.contactTagAssignment.deleteMany({
      where: { contactId, tagId },
    });
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
