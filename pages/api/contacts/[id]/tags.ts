import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { handleApiError } from "@/lib/api/guards";
import { asStr, isUuid } from "@/lib/api/parsing";

/** Same values `asArray` would give, but filtered to UUID-shaped ids — contact_tags.id is a
 *  @db.Uuid column, so a malformed entry here would otherwise make Prisma throw (P2007) instead
 *  of just being silently excluded like any other id that doesn't name a real tag. */
function asUuidArray(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v.map((entry) => asStr(entry)).filter(isUuid);
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
  // contacts.id is a @db.Uuid column — a non-UUID id would make Prisma throw (P2007) instead of
  // the plain "not found" below.
  if (!isUuid(contactId)) {
    res.status(404).json({ message: "Contact not found." });
    return;
  }

  try {
    // Contacts are client-scoped now (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — looked up
    // by id alone, not user_id. Tags themselves stay personal to the tagging user for now (out of
    // the client-scoping ask).
    const contact = await prisma.contact.findFirst({
      where: { id: contactId },
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
      if (!tagId || !isUuid(tagId)) {
        res.status(400).json({ message: "A valid tagId is required" });
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
      const tagIds = asUuidArray(req.body?.tagIds);
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
      if (!tagId || !isUuid(tagId)) {
        res.status(400).json({ message: "A valid tagId is required" });
        return;
      }
      await prisma.contactTagAssignment.deleteMany({
        where: { contact_id: contactId, tag_id: tagId },
      });
      res.status(200).json({ ok: true });
      return;
    }
  } catch (e) {
    handleApiError(res, `contacts/[id]/tags ${req.method}`, e, "Failed to process tag request.");
  }
}, { methods: ["GET", "POST", "PUT", "DELETE"] });
