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
