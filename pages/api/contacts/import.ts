import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseContactsCsvWithValidation } from "@/lib/contacts/csv";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_REGEX = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?$/i;

function hasLiteralNull(value: string) {
  return value.trim().toLowerCase() === "null";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  const csvText = typeof req.body?.csvText === "string" ? req.body.csvText : "";
  const accountEmail = typeof req.body?.accountEmail === "string" ? req.body.accountEmail.trim().toLowerCase() : "";
  if (!csvText.trim()) {
    res.status(400).json({ message: "csvText is required." });
    return;
  }

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

  const rows = parsed.rows;
  let imported = 0;
  let skipped = 0;
  const createdTagIds = new Map<string, string>();
  const normalizedAccountEmail = accountEmail || null;
  const rowErrors: Array<{ lineNumber: number; email: string; reasons: string[] }> = [];

  for (const row of rows as ImportedRow[]) {
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
      rowErrors.push({ lineNumber: row.lineNumber || 0, email, reasons });
      continue;
    }

    const updateData = {
      firstName: row.firstName || null,
      lastName: row.lastName || null,
      phone: normalizedPhone || null,
      business: row.business || null,
      website: row.website || null,
      address: row.address || null,
    };
    const createData = {
      userId,
      accountEmail: normalizedAccountEmail,
      source: "CSV" as const,
      email,
      ...updateData,
    };

    const contact = normalizedAccountEmail
      ? await prisma.contact.upsert({
          where: {
            userId_accountEmail_email: {
              userId,
              accountEmail: normalizedAccountEmail,
              email,
            },
          },
          create: createData,
          update: updateData,
        })
      : await (async () => {
          const existing = await prisma.contact.findFirst({
            where: {
              userId,
              accountEmail: null,
              email,
            },
            select: { id: true },
          });
          if (existing) {
            return prisma.contact.update({
              where: { id: existing.id },
              data: updateData,
            });
          }
          return prisma.contact.create({ data: createData });
        })();
    imported += 1;

    const tagNames = parseTagList(row.tags);
    if (tagNames.length > 0) {
      for (const tagName of tagNames) {
        let tagId = createdTagIds.get(tagName);
        if (!tagId) {
          const tag = await prisma.contactTag.upsert({
            where: {
              userId_name: { userId, name: tagName },
            },
            update: {},
            create: { userId, name: tagName },
          });
          tagId = tag.id;
          createdTagIds.set(tagName, tag.id);
        }
        await prisma.contactTagAssignment.upsert({
          where: {
            contactId_tagId: { contactId: contact.id, tagId },
          },
          update: {},
          create: { contactId: contact.id, tagId },
        });
      }
    }
  }

  if (imported > 0) {
    await syncContactsSpreadsheetForUser({ userId });
  }
  res.status(200).json({
    imported,
    skipped,
    totalRows: rows.length,
    errors: rowErrors,
    headerErrors: [],
  });
}
