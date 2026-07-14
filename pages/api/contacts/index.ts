import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { serializeContact } from "@/lib/api/contacts";
import { asStr, asQueryStr } from "@/lib/api/parsing";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  if (req.method === "GET") {
    const accountEmail = asQueryStr(req.query.accountEmail).trim().toLowerCase();
    const search = asQueryStr(req.query.search).trim();
    const source = asQueryStr(req.query.source).trim().toLowerCase();
    const tagIds = asQueryStr(req.query.tagIds)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const pageRaw = Number(asQueryStr(req.query.page));
    const limitRaw = Number(asQueryStr(req.query.limit));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 50;

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

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: {
          email_provider_accounts: { select: { account_email: true } },
          contact_tag_assignments: { include: { contact_tags: true } },
        },
        orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { created_at: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.status(200).json({
      contacts: contacts.map((contact) => ({
        ...serializeContact(contact),
        tags: contact.contact_tag_assignments.map((assignment) => assignment.contact_tags),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const email = asStr(req.body?.email).toLowerCase();
    if (!email) {
      res.status(400).json({ message: "Email is required." });
      return;
    }
    const accountId = await resolveAccountId(userId, accountEmail);

    const created = await prisma.contact.create({
      data: {
        user_id: userId,
        account_id: accountId,
        source: "manual",
        first_name: asStr(req.body?.firstName) || null,
        last_name: asStr(req.body?.lastName) || null,
        email,
        phone: asStr(req.body?.phone) || null,
        business: asStr(req.body?.business) || null,
        website: asStr(req.body?.website) || null,
        address: asStr(req.body?.address) || null,
      },
      include: { email_provider_accounts: { select: { account_email: true } } },
    });
    await syncContactsSpreadsheetForUser({ userId, companyId: session.companyId });
    res.status(201).json({ contact: serializeContact(created) });
    return;
  }
}, { methods: ["GET", "POST"] });
