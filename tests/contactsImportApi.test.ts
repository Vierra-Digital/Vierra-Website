import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/contacts/import.ts — bulk CSV import. Never had a route test. This used to run every
 * row through mapInBatches with no per-item try/catch, so a single row failing partway through
 * the write phase (e.g. a stale companyId) rejected the *whole* batch and reported nothing back,
 * even though the DB writes for other rows had already committed. These pin the fix: one bad row
 * is isolated to that row, and everything else still imports and gets reported as such.
 */

const db = vi.hoisted(() => ({
  contactTag: { upsert: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  contactTagAssignment: { createMany: vi.fn() },
  emailProviderAccount: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/contacts/xlsx", () => ({ syncContactsSpreadsheetForUser: vi.fn() }));

const parseContactsCsvWithValidation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/contacts/csv", () => ({ parseContactsCsvWithValidation }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/contacts/import";

type Row = {
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

function row(overrides: Partial<Row> = {}): Row {
  return {
    lineNumber: 2,
    firstName: "Sam",
    lastName: "Reed",
    email: "sam@example.com",
    phone: "",
    business: "",
    website: "",
    address: "",
    tags: "",
    ...overrides,
  };
}

async function call(csvText: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler(
    { method: "POST", body: { csvText, accountEmail: "" }, query: {} } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.emailProviderAccount.findFirst.mockResolvedValue(null);
  db.contact.findFirst.mockResolvedValue(null);
  db.contact.create.mockImplementation(async ({ data }: { data: { email: string } }) => ({ id: `id-${data.email}` }));
  parseContactsCsvWithValidation.mockReturnValue({ rows: [], headerErrors: [], normalizedHeaders: [] });
});

it("400s an empty/missing csvText without ever calling the parser", async () => {
  const res = await call("");
  expect(res.status).toHaveBeenCalledWith(400);
  expect(parseContactsCsvWithValidation).not.toHaveBeenCalled();
});

it("400s and reports header errors verbatim, writing nothing", async () => {
  parseContactsCsvWithValidation.mockReturnValue({ rows: [], headerErrors: ['Missing required header "Email".'], normalizedHeaders: [] });
  const res = await call("First Name\nSam");
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    message: "CSV headers are invalid.",
    headerErrors: ['Missing required header "Email".'],
    imported: 0,
    skipped: 0,
    errors: [],
  });
  expect(db.contact.create).not.toHaveBeenCalled();
});

it("skips a row with an invalid email and reports why, importing nothing for it", async () => {
  parseContactsCsvWithValidation.mockReturnValue({ rows: [row({ email: "not-an-email" })], headerErrors: [] });
  const res = await call("csv");
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      imported: 0,
      skipped: 1,
      errors: [expect.objectContaining({ email: "not-an-email", reasons: ["Email is invalid."] })],
    })
  );
  expect(db.contact.create).not.toHaveBeenCalled();
});

it("skips a row containing a literal NULL value", async () => {
  parseContactsCsvWithValidation.mockReturnValue({ rows: [row({ business: "NULL" })], headerErrors: [] });
  const res = await call("csv");
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ skipped: 1, errors: [expect.objectContaining({ reasons: ['Contains "NULL" value(s).'] })] })
  );
});

it("skips a row with a phone that isn't exactly 10 digits", async () => {
  parseContactsCsvWithValidation.mockReturnValue({ rows: [row({ phone: "123" })], headerErrors: [] });
  const res = await call("csv");
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ skipped: 1, errors: [expect.objectContaining({ reasons: ["Phone must contain exactly 10 digits."] })] })
  );
});

it("skips a row with a malformed website URL", async () => {
  parseContactsCsvWithValidation.mockReturnValue({ rows: [row({ website: "not a url" })], headerErrors: [] });
  const res = await call("csv");
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ skipped: 1, errors: [expect.objectContaining({ reasons: ["Website URL is invalid."] })] })
  );
});

it("isolates a single row's DB write failure instead of losing the whole batch", async () => {
  parseContactsCsvWithValidation.mockReturnValue({
    rows: [row({ email: "good@example.com", lineNumber: 2 }), row({ email: "bad@example.com", lineNumber: 3 })],
    headerErrors: [],
  });
  db.contact.create.mockImplementation(async ({ data }: { data: { email: string } }) => {
    if (data.email === "bad@example.com") throw new Error("connection reset mid-write");
    return { id: `id-${data.email}` };
  });
  const res = await call("csv");
  // Both rows validated fine (2 "imported" going in), but only one write actually succeeded —
  // the failed one moves to skipped/writeErrors rather than taking the successful one down with it.
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ imported: 1, skipped: 1, writeErrors: ["bad@example.com"] })
  );
  expect(db.contact.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "good@example.com" }) }));
});

it("isolates a single tag's resolution failure instead of losing the whole batch", async () => {
  parseContactsCsvWithValidation.mockReturnValue({
    rows: [row({ email: "sam@example.com", tags: "Bad Tag" })],
    headerErrors: [],
  });
  db.contactTag.upsert.mockRejectedValue(new Error("constraint violation"));
  const res = await call("csv");
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1, skipped: 0 }));
  // The contact still imports; it just never gets a tag assignment for the one that failed.
  expect(db.contactTagAssignment.createMany).not.toHaveBeenCalled();
});

it("falls back to a generic 500 for a genuinely unexpected error, not a crash", async () => {
  parseContactsCsvWithValidation.mockImplementation(() => {
    throw new Error("parser exploded");
  });
  const res = await call("csv");
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: "Failed to import contacts." });
});
