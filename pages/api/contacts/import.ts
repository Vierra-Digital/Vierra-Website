import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX } from "@/lib/utils";
import { withAuth } from "@/lib/api/withAuth";
import { parseContactsCsvWithValidation } from "@/lib/contacts/csv";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { mapInBatches } from "@/lib/batch";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

type ImportedRow = {
  lineNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  website: string;
  address: string;
  tags: string;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

function normalizeTagName(value: string) {
  return value.trim();
}

function parseTagList(input: string) {
  return input
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => entry.split(","))
    .map(normalizeTagName)
    .filter(Boolean);
}

const WEBSITE_REGEX = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i;

function hasLiteralNull(value: string) {
  return value.trim().toLowerCase() === "null";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const companyId = resolveTargetCompanyId(session, req);
  if (!companyId) {
    res.status(400).json({ message: "companyId is required" });
    return;
  }

  const csvText = typeof req.body?.csvText === "string" ? req.body.csvText : "";
  if (!csvText.trim()) {
    res.status(400).json({ message: "csvText is required." });
    return;
  }
  const accountEmail = typeof req.body?.accountEmail === "string" ? req.body.accountEmail.trim().toLowerCase() : "";
  const accountId = await resolveAccountId(userId, accountEmail);

  const parsed = parseContactsCsvWithValidation(csvText);
  if (parsed.headerErrors.length > 0) {
    res.status(400).json({
      message: "CSV headers are invalid.",
      headerErrors: parsed.headerErrors,
      imported: 0,
      skipped: 0,
      errors: [],
    });
    return;
  }

  const rows = parsed.rows as ImportedRow[];
  let skipped = 0;
  const rowErrors: Array<ImportedRow & { reasons: string[] }> = [];

  type ContactWrite = {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    business: string | null;
    website: string | null;
    address: string | null;
  };

  // Phase 1 — validate every row IN ORDER (pure/in-memory, no DB). Keeping this sequential is what
  // preserves the CSV order of `rowErrors` (which feeds the inline correction table) and the exact
  // `skipped` count. Valid rows are collected for the batched write phase below.
  const validRows: Array<{ email: string; data: ContactWrite; tagNames: string[] }> = [];
  for (const row of rows) {
    const email = row.email.toLowerCase();
    const reasons: string[] = [];

    const fields = [
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.business,
      row.website,
      row.address,
      row.tags,
    ];
    if (fields.some((field) => hasLiteralNull(field))) {
      reasons.push('Contains "NULL" value(s).');
    }
    if (!row.firstName.trim()) {
      reasons.push("First Name is required.");
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      reasons.push("Email is invalid.");
    }
    const normalizedPhone = row.phone.trim() ? normalizePhone(row.phone.trim()) : null;
    if (row.phone.trim() && !normalizedPhone) {
      reasons.push("Phone must contain exactly 10 digits.");
    }
    if (row.website.trim() && !WEBSITE_REGEX.test(row.website.trim())) {
      reasons.push("Website URL is invalid.");
    }
    if (reasons.length > 0) {
      skipped += 1;
      rowErrors.push({ ...row, email, reasons });
      continue;
    }

    validRows.push({
      email,
      data: {
        first_name: row.firstName || null,
        last_name: row.lastName || null,
        phone: normalizedPhone || null,
        business: row.business || null,
        website: row.website || null,
        address: row.address || null,
      },
      tagNames: parseTagList(row.tags),
    });
  }
  // Every valid row counts as imported (matching the prior per-row increment), even if two rows
  // share an email and resolve to the same contact.
  const imported = validRows.length;

  // Collapse duplicate-email rows so the concurrent write phase never targets the same contact key
  // twice at once (which would race to a P2002). Last occurrence wins for the contact fields
  // (matching the prior serial last-write-wins); tags union across all rows for that email.
  const byEmail = new Map<string, { data: ContactWrite; tagNames: Set<string> }>();
  for (const v of validRows) {
    const existing = byEmail.get(v.email);
    if (existing) {
      existing.data = v.data;
      v.tagNames.forEach((t) => existing.tagNames.add(t));
    } else {
      byEmail.set(v.email, { data: v.data, tagNames: new Set(v.tagNames) });
    }
  }

  // Phase 2 — resolve every DISTINCT tag once up front, so the write phase never races to create
  // the same tag (this replaces the per-row shared cache that couldn't be parallelized safely).
  const tagIdByName = new Map<string, string>();
  const allTagNames = [...new Set([...byEmail.values()].flatMap((v) => [...v.tagNames]))];
  await mapInBatches(allTagNames, async (name) => {
    const tag = await prisma.contactTag.upsert({
      where: { user_id_name: { user_id: userId, name } },
      update: {},
      create: { user_id: userId, name },
    });
    tagIdByName.set(name, tag.id);
  });

  // Phase 3 — upsert contacts with bounded concurrency. Emails are unique after the collapse above,
  // so there are no key races; each returns its id + tag names for the assignment phase.
  const written = await mapInBatches([...byEmail.entries()], async ([email, v]) => {
    const createData = {
      company_id: companyId,
      user_id: userId,
      account_id: accountId,
      source: "csv" as const,
      email,
      ...v.data,
    };
    const contact = accountId
      ? await prisma.contact.upsert({
          where: { company_id_account_id_email: { company_id: companyId, account_id: accountId, email } },
          create: createData,
          update: v.data,
        })
      : await (async () => {
          const existing = await prisma.contact.findFirst({
            where: { company_id: companyId, account_id: null, email },
            select: { id: true },
          });
          if (existing) return prisma.contact.update({ where: { id: existing.id }, data: v.data });
          return prisma.contact.create({ data: createData });
        })();
    return { contactId: contact.id, tagNames: v.tagNames };
  });

  // Phase 4 — write all tag assignments in one query. skipDuplicates makes it idempotent, matching
  // the prior per-assignment upsert-with-empty-update.
  const assignments = written.flatMap(({ contactId, tagNames }) =>
    [...tagNames]
      .map((name) => tagIdByName.get(name))
      .filter((id): id is string => Boolean(id))
      .map((tag_id) => ({ contact_id: contactId, tag_id }))
  );
  if (assignments.length > 0) {
    await prisma.contactTagAssignment.createMany({ data: assignments, skipDuplicates: true });
  }

  if (imported > 0) {
    await syncContactsSpreadsheetForUser({ userId, companyId });
  }
  res.status(200).json({
    imported,
    skipped,
    totalRows: rows.length,
    errors: rowErrors,
    headerErrors: [],
  });
}, { methods: ["POST"] });
