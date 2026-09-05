import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { serializeContact } from "@/lib/api/contacts";
import { asStr, asQueryStr } from "@/lib/api/parsing";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";
import { normalizePhone } from "@/lib/contacts/phone";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  // Contacts are client-scoped (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — everyone
  // working a client (staff or representative) sees the same contacts, not just whoever added
  // each one. user_id survives only as attribution now.
  const companyId = resolveTargetCompanyId(session, req);
  if (!companyId) {
    res.status(400).json({ message: "companyId is required" });
    return;
  }

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

    const where: any = { company_id: companyId };
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

    res.setHeader("Cache-Control", "private, max-age=15");
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
    const rawPhone = asStr(req.body?.phone);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) {
      res.status(400).json({ message: "Phone must contain exactly 10 digits." });
      return;
    }
    const accountId = await resolveAccountId(userId, accountEmail);

    const data = {
      first_name: asStr(req.body?.firstName) || null,
      last_name: asStr(req.body?.lastName) || null,
      phone,
      business: asStr(req.body?.business) || null,
      website: asStr(req.body?.website) || null,
      address: asStr(req.body?.address) || null,
    };
    // Same key the CSV import upserts on (company_id, account_id, email) — matching that path here
    // closes the gap where account_id is null: Postgres doesn't enforce the unique constraint
    // across NULLs, so a bare create would otherwise silently duplicate an existing contact.
    const createData = { company_id: companyId, user_id: userId, account_id: accountId, source: "manual" as const, email, ...data };
    const created = accountId
      ? await prisma.contact.upsert({
          where: { company_id_account_id_email: { company_id: companyId, account_id: accountId, email } },
          create: createData,
          update: data,
          include: { email_provider_accounts: { select: { account_email: true } } },
        })
      : await (async () => {
          const existing = await prisma.contact.findFirst({
            where: { company_id: companyId, account_id: null, email },
            select: { id: true },
          });
          if (existing) {
            return prisma.contact.update({
              where: { id: existing.id },
              data,
              include: { email_provider_accounts: { select: { account_email: true } } },
            });
          }
          return prisma.contact.create({
            data: createData,
            include: { email_provider_accounts: { select: { account_email: true } } },
          });
        })();
    await syncContactsSpreadsheetForUser({ userId, companyId });
    res.status(201).json({ contact: serializeContact(created) });
    return;
  }
}, { methods: ["GET", "POST"] });
