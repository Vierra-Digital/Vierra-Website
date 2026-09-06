import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { toContactsCsv } from "@/lib/contacts/csv";
import { buildContactsWhere } from "@/lib/api/contacts";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const companyId = resolveTargetCompanyId(session, req);
  if (!companyId) {
    res.status(400).json({ message: "companyId is required" });
    return;
  }

  const where = await buildContactsWhere(userId, companyId, req.query);

  try {
    const contacts = await prisma.contact.findMany({
      where,
      include: {
        contact_tag_assignments: {
          include: {
            contact_tags: true,
          },
        },
      },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    });

    const csv = toContactsCsv(
      contacts.map((contact) => ({
        firstName: contact.first_name || "",
        lastName: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        business: contact.business || "",
        website: contact.website || "",
        address: contact.address || "",
        tags: contact.contact_tag_assignments.map((assignment) => assignment.contact_tags.name).join("|"),
      }))
    );

    const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (e) {
    console.error("contacts/export", e);
    res.status(500).json({ message: "Failed to export contacts." });
  }
}, { methods: ["GET"] });
