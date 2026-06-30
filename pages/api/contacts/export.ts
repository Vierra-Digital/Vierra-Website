import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { toContactsCsv } from "@/lib/contacts/csv";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asQueryStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  const accountEmail = asQueryStr(req.query.accountEmail).toLowerCase();
  const search = asQueryStr(req.query.search);
  const source = asQueryStr(req.query.source).toLowerCase();
  const tagIds = asQueryStr(req.query.tagIds)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const where: any = { user_id: userId };
  if (accountEmail) {
    const accountId = await resolveAccountId(userId, accountEmail);
    where.account_id = accountId ?? "__none__";
  }
  if (source && ["manual", "gmail", "csv"].includes(source)) where.source = source;
  if (search) {
    where.OR = [
      { first_name: { contains: search, mode: "insensitive" } },
      { last_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { business: { contains: search, mode: "insensitive" } },
    ];
  }
  if (tagIds.length > 0) {
    where.contact_tag_assignments = {
      some: {
        tag_id: { in: tagIds },
      },
    };
  }

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
}, { methods: ["GET"] });
