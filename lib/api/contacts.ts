import type { Prisma } from "@/lib/generated/prisma/client";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { asQueryStr } from "@/lib/api/parsing";

/** The query params both the contacts list and the CSV export filter on. */
export type ContactsQuery = {
  accountEmail?: string | string[];
  search?: string | string[];
  source?: string | string[];
  tagIds?: string | string[];
};

const FILTERABLE_SOURCES = ["manual", "gmail", "csv"];

/**
 * Build the Prisma filter for a contacts query.
 *
 * /api/contacts (the list the panel shows) and /api/contacts/export (the CSV) carried this same
 * ~26-line block character for character. They have to agree: the export is meant to be exactly
 * what is on screen, so any drift between the two silently produces a CSV that does not match the
 * filters the user set. Sharing it makes that impossible rather than merely unlikely.
 *
 * Typed as Prisma.ContactWhereInput rather than the `any` both copies used, so a mistyped relation
 * or operator is a compile error instead of a filter that quietly matches everything.
 */
export async function buildContactsWhere(
  userId: string,
  query: ContactsQuery
): Promise<Prisma.ContactWhereInput> {
  const accountEmail = asQueryStr(query.accountEmail).toLowerCase();
  const search = asQueryStr(query.search);
  const source = asQueryStr(query.source).toLowerCase();
  const tagIds = asQueryStr(query.tagIds)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const where: Prisma.ContactWhereInput = { user_id: userId };

  if (accountEmail) {
    const accountId = await resolveAccountId(userId, accountEmail);
    // A filter for an account that does not resolve must match nothing, not everything.
    where.account_id = accountId ?? "__none__";
  }
  if (source && FILTERABLE_SOURCES.includes(source)) where.source = source;
  if (search) {
    where.OR = [
      { first_name: { contains: search, mode: "insensitive" } },
      { last_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { business: { contains: search, mode: "insensitive" } },
    ];
  }
  if (tagIds.length > 0) {
    where.contact_tag_assignments = { some: { tag_id: { in: tagIds } } };
  }

  return where;
}
type ContactRow = {
  id: string;
  source: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  business: string | null;
  website: string | null;
  address: string | null;
  gmail_resource_name: string | null;
  gmail_etag: string | null;
  created_at: Date;
  updated_at: Date;
  email_provider_accounts?: { account_email: string } | null;
};

/** Shapes a Contact row (snake_case Prisma fields) back to the frontend's camelCase contract. */
export function serializeContact(row: ContactRow) {
  return {
    id: row.id,
    accountEmail: row.email_provider_accounts?.account_email ?? null,
    source: row.source,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    business: row.business,
    website: row.website,
    address: row.address,
    gmailResourceName: row.gmail_resource_name,
    gmailEtag: row.gmail_etag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
