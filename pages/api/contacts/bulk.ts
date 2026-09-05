import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { asStr } from "@/lib/api/parsing";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

function asIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((entry) => asStr(entry)).filter(Boolean))];
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const companyId = resolveTargetCompanyId(session, req);
  if (!companyId) {
    res.status(400).json({ message: "companyId is required" });
    return;
  }

  const ids = asIdArray(req.body?.ids);
  if (ids.length === 0) {
    res.status(400).json({ message: "ids is required" });
    return;
  }
  // Scope every bulk write to this company's own contacts — a batch of ids can't reach into
  // another client's contact list even if one slipped in from a stale selection.
  const owned = await prisma.contact.findMany({
    where: { id: { in: ids }, company_id: companyId },
    select: { id: true },
  });
  const ownedIds = owned.map((c) => c.id);
  if (ownedIds.length === 0) {
    res.status(404).json({ message: "No matching contacts found." });
    return;
  }

  if (req.method === "DELETE") {
    await prisma.contact.deleteMany({ where: { id: { in: ownedIds } } });
    await syncContactsSpreadsheetForUser({ userId, companyId });
    res.status(200).json({ deleted: ownedIds.length });
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
    await prisma.contactTagAssignment.createMany({
      data: ownedIds.map((contactId) => ({ contact_id: contactId, tag_id: tagId })),
      skipDuplicates: true,
    });
    res.status(200).json({ tagged: ownedIds.length });
    return;
  }
}, { methods: ["DELETE", "POST"] });
