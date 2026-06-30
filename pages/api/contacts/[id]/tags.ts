import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

function asArray(v: unknown) {
  if (Array.isArray(v)) return v.map((entry) => asStr(entry)).filter(Boolean);
  return [];
}

function getContactId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const contactId = getContactId(req);
  if (!contactId) {
    res.status(400).json({ message: "Contact id is required." });
    return;
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, user_id: userId },
  });
  if (!contact) {
    res.status(404).json({ message: "Contact not found." });
    return;
  }

  if (req.method === "GET") {
    const tags = await prisma.contactTagAssignment.findMany({
      where: { contact_id: contactId },
      include: { contact_tags: true },
      orderBy: { created_at: "asc" },
    });
    res.status(200).json({ tags: tags.map((row) => row.contact_tags) });
    return;
  }

  if (req.method === "POST") {
    const tagId = asStr(req.body?.tagId);
    if (!tagId) {
      res.status(400).json({ message: "tagId is required" });
      return;
    }
    const tag = await prisma.contactTag.findFirst({ where: { id: tagId, user_id: userId } });
    if (!tag) {
      res.status(404).json({ message: "Tag not found." });
      return;
    }
    await prisma.contactTagAssignment.upsert({
      where: { contact_id_tag_id: { contact_id: contactId, tag_id: tagId } },
      update: {},
      create: { contact_id: contactId, tag_id: tagId },
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "PUT") {
    const tagIds = asArray(req.body?.tagIds);
    const validTags = await prisma.contactTag.findMany({
      where: { user_id: userId, id: { in: tagIds } },
      select: { id: true },
    });
    const validTagIds = validTags.map((tag) => tag.id);

    await prisma.contactTagAssignment.deleteMany({ where: { contact_id: contactId } });
    if (validTagIds.length > 0) {
      await prisma.contactTagAssignment.createMany({
        data: validTagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId })),
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
      where: { contact_id: contactId, tag_id: tagId },
    });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "POST", "PUT", "DELETE"] });
