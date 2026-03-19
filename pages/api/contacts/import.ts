import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { parseContactsCsv } from "@/lib/contacts/csv";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";

type ImportedRow = {
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

  const rows = parseContactsCsv(csvText).filter((row) => row.email);
  let imported = 0;
  const createdTagIds = new Map<string, string>();

  for (const row of rows as ImportedRow[]) {
    const email = row.email.toLowerCase();
    const contact = await prisma.contact.upsert({
      where: {
        userId_accountEmail_email: {
          userId,
          accountEmail: accountEmail || null,
          email,
        },
      },
      create: {
        userId,
        accountEmail: accountEmail || null,
        source: "CSV",
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        email,
        phone: row.phone || null,
        business: row.business || null,
        website: row.website || null,
        address: row.address || null,
      },
      update: {
        firstName: row.firstName || null,
        lastName: row.lastName || null,
        phone: row.phone || null,
        business: row.business || null,
        website: row.website || null,
        address: row.address || null,
      },
    });
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

  await syncContactsSpreadsheetForUser({ userId });
  res.status(200).json({ imported });
}
