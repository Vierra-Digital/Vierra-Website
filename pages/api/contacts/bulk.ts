import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { handleApiError } from "@/lib/api/guards";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { asStr, isUuid } from "@/lib/api/parsing";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/** contacts.id is a @db.Uuid column — a malformed entry would otherwise make the `{ in: ids }`
 *  lookup below throw (P2007) instead of just not matching, like any other id that isn't real. */
function asIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((entry) => asStr(entry)).filter(isUuid))];
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
  try {
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
      if (!tagId || !isUuid(tagId)) {
        res.status(400).json({ message: "A valid tagId is required" });
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
  } catch (e) {
    handleApiError(res, `contacts/bulk ${req.method}`, e, "Failed to process bulk contact request.");
  }
}, { methods: ["DELETE", "POST"] });
