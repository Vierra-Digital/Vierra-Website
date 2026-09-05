import type { NextApiRequest } from "next";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { serializeContact } from "@/lib/api/contacts";
import { asStr } from "@/lib/api/parsing";
import { normalizePhone } from "@/lib/contacts/phone";

function getId(req: NextApiRequest) {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw || "";
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const id = getId(req);
  if (!id) {
    res.status(400).json({ message: "Contact id is required." });
    return;
  }

  // Contacts are client-scoped now (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — looked up
  // by id alone, not user_id, since any Vierra staff member may act on any client's contact.
  const existing = await prisma.contact.findFirst({
    where: { id },
    include: {
      email_provider_accounts: { select: { account_email: true } },
      contact_tag_assignments: { include: { contact_tags: true } },
    },
  });
  if (!existing) {
    res.status(404).json({ message: "Contact not found." });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({
      contact: {
        ...serializeContact(existing),
        tags: existing.contact_tag_assignments.map((assignment) => assignment.contact_tags),
      },
    });
    return;
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    let phone = existing.phone;
    if (req.body?.phone !== undefined) {
      const rawPhone = asStr(req.body?.phone);
      phone = rawPhone ? normalizePhone(rawPhone) : null;
      if (rawPhone && !phone) {
        res.status(400).json({ message: "Phone must contain exactly 10 digits." });
        return;
      }
    }
    const updated = await prisma.contact.update({
      where: { id },
      data: {
        first_name: req.body?.firstName !== undefined ? asStr(req.body?.firstName) || null : existing.first_name,
        last_name: req.body?.lastName !== undefined ? asStr(req.body?.lastName) || null : existing.last_name,
        email: req.body?.email !== undefined ? asStr(req.body?.email).toLowerCase() || existing.email : existing.email,
        phone,
        business: req.body?.business !== undefined ? asStr(req.body?.business) || null : existing.business,
        website: req.body?.website !== undefined ? asStr(req.body?.website) || null : existing.website,
        address: req.body?.address !== undefined ? asStr(req.body?.address) || null : existing.address,
      },
      include: { email_provider_accounts: { select: { account_email: true } } },
    });
    await syncContactsSpreadsheetForUser({ userId, companyId: existing.company_id });
    res.status(200).json({ contact: serializeContact(updated) });
    return;
  }

  if (req.method === "DELETE") {
    await prisma.contact.delete({ where: { id } });
    await syncContactsSpreadsheetForUser({ userId, companyId: existing.company_id });
    res.status(200).json({ ok: true });
    return;
  }
}, { methods: ["GET", "PUT", "PATCH", "DELETE"] });
