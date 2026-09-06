import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/contacts and /api/contacts/export carried this filter twice, character for character. The
 * export is meant to be exactly what the list shows, so any drift between the two produces a CSV
 * that does not match the filters the user set — a wrong answer that looks like a right one.
 *
 * These pin the filter's shape so the shared builder cannot drift from what both routes need.
 * resolveAccountId is the only part that touches the database, so it is mocked; everything else
 * here is pure.
 */

const resolveAccountId = vi.fn<(userId: string, email: string) => Promise<string | null>>();
vi.mock("@/lib/api/emailAccounts", () => ({
  resolveAccountId: (userId: string, email: string) => resolveAccountId(userId, email),
}));

const { buildContactsWhere, serializeContact } = await import("@/lib/api/contacts");

const USER = "user-1";

beforeEach(() => {
  resolveAccountId.mockReset();
});

describe("buildContactsWhere", () => {
  it("always scopes to the user, even with no filters", async () => {
    expect(await buildContactsWhere(USER, {})).toEqual({ user_id: USER });
    expect(resolveAccountId).not.toHaveBeenCalled();
  });

  it("searches the four fields the list searches, case-insensitively", async () => {
    const where = await buildContactsWhere(USER, { search: "acme" });
    expect(where.OR).toEqual([
      { first_name: { contains: "acme", mode: "insensitive" } },
      { last_name: { contains: "acme", mode: "insensitive" } },
      { email: { contains: "acme", mode: "insensitive" } },
      { business: { contains: "acme", mode: "insensitive" } },
    ]);
  });

  it("accepts only the three real sources and ignores anything else", async () => {
    for (const source of ["manual", "gmail", "csv"]) {
      expect((await buildContactsWhere(USER, { source })).source).toBe(source);
    }
    // Case and padding are normalised rather than rejected (see the next case); this list is
    // for values that are genuinely not a source. Such a value must not become a filter —
    // matching nothing would read to the user as "this account has no contacts".
    for (const source of ["", "sql", "'; drop table contacts;--", "manualx"]) {
      expect((await buildContactsWhere(USER, { source })).source, source).toBeUndefined();
    }
  });

  it("uppercases and pads are tolerated on source, since the query string is not trusted", async () => {
    expect((await buildContactsWhere(USER, { source: "  GMAIL  " })).source).toBe("gmail");
  });

  it("matches nothing when the account filter does not resolve", async () => {
    resolveAccountId.mockResolvedValue(null);
    const where = await buildContactsWhere(USER, { accountEmail: "gone@example.com" });
    // The alternative — leaving account_id unset — would return every contact for a filter the
    // user believes is narrowing the list.
    expect(where.account_id).toBe("__none__");
  });

  it("uses the resolved account id, lowercasing the address first", async () => {
    resolveAccountId.mockResolvedValue("acct-9");
    const where = await buildContactsWhere(USER, { accountEmail: "Sam@Example.COM" });
    expect(resolveAccountId).toHaveBeenCalledWith(USER, "sam@example.com");
    expect(where.account_id).toBe("acct-9");
  });

  it("splits tag ids on commas and drops the empties", async () => {
    const where = await buildContactsWhere(USER, { tagIds: "a, b ,,c," });
    expect(where.contact_tag_assignments).toEqual({ some: { tag_id: { in: ["a", "b", "c"] } } });
  });

  it("omits the tag filter entirely when no ids survive", async () => {
    for (const tagIds of ["", " ", ",,,"]) {
      expect((await buildContactsWhere(USER, { tagIds })).contact_tag_assignments, tagIds).toBeUndefined();
    }
  });

  it("combines every filter at once", async () => {
    resolveAccountId.mockResolvedValue("acct-1");
    const where = await buildContactsWhere(USER, {
      accountEmail: "a@b.co",
      search: "acme",
      source: "csv",
      tagIds: "t1,t2",
    });
    expect(where.user_id).toBe(USER);
    expect(where.account_id).toBe("acct-1");
    expect(where.source).toBe("csv");
    expect(where.OR).toHaveLength(4);
    expect(where.contact_tag_assignments).toBeTruthy();
  });

  it("takes the first value when a param arrives repeated", async () => {
    // Next hands `?source=csv&source=gmail` over as an array.
    expect((await buildContactsWhere(USER, { source: ["csv", "gmail"] })).source).toBe("csv");
  });
});

describe("serializeContact", () => {

  const row = {
    id: "c1",
    source: "gmail",
    first_name: "Sam",
    last_name: "Reed",
    email: "sam@acme.co",
    phone: "+1 555 0100",
    business: "Acme",
    website: "https://acme.co",
    address: "1 Main St",
    gmail_resource_name: "people/c123",
    gmail_etag: "etag1",
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-02-01T00:00:00Z"),
  };

  it("renames the snake_case columns to the camelCase the panel consumes", () => {
    expect(serializeContact({ ...row, email_provider_accounts: { account_email: "me@acme.co" } })).toEqual({
      id: "c1",
      accountEmail: "me@acme.co",
      source: "gmail",
      firstName: "Sam",
      lastName: "Reed",
      email: "sam@acme.co",
      phone: "+1 555 0100",
      business: "Acme",
      website: "https://acme.co",
      address: "1 Main St",
      gmailResourceName: "people/c123",
      gmailEtag: "etag1",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("gives accountEmail as null when the contact has no linked account", () => {
    // A manually-added contact has no email_provider_accounts relation; `undefined` would drop the
    // key from the JSON entirely and the panel reads it directly.
    expect(serializeContact(row).accountEmail).toBeNull();
    expect(serializeContact({ ...row, email_provider_accounts: null }).accountEmail).toBeNull();
  });

  it("passes nullable columns through as null rather than coercing them", () => {
    const sparse = serializeContact({
      ...row,
      first_name: null,
      last_name: null,
      phone: null,
      business: null,
      website: null,
      address: null,
      gmail_resource_name: null,
      gmail_etag: null,
    });
    expect(sparse.firstName).toBeNull();
    expect(sparse.phone).toBeNull();
    expect(sparse.gmailEtag).toBeNull();
    // email and id are non-nullable in the schema and must survive untouched.
    expect(sparse.email).toBe("sam@acme.co");
  });
});
