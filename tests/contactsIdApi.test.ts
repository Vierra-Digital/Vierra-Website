import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * pages/api/contacts/[id].ts — GET/PUT/PATCH/DELETE on a single contact. Previously untested at
 * the route level: nothing here caught a regression in the isUuid guard, the phone validation, or
 * the two P2002/P2025 gaps closed via the shared Prisma-error mapper (a renamed-to-a-duplicate
 * email on update, and a delete racing an already-deleted row).
 */

const db = vi.hoisted(() => ({
  contact: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/contacts/xlsx", () => ({ syncContactsSpreadsheetForUser: vi.fn() }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/contacts/[id]";

const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const contact = {
  id: CONTACT_ID,
  company_id: "company-1",
  first_name: "Sam",
  last_name: "Reed",
  email: "sam@example.com",
  phone: null,
  business: null,
  website: null,
  address: null,
  gmail_resource_name: null,
  gmail_etag: null,
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  email_provider_accounts: null,
  contact_tag_assignments: [],
};

function prismaKnownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("simulated", { code, clientVersion: "test" });
}

async function call(method: string, id: unknown, body: Record<string, unknown> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method, query: { id }, body } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.contact.findFirst.mockResolvedValue(contact);
});

it("400s a missing id without touching the database", async () => {
  const res = await call("GET", undefined);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: "Contact id is required." });
  expect(db.contact.findFirst).not.toHaveBeenCalled();
});

it("404s a malformed (non-UUID) id without touching the database", async () => {
  // contacts.id is a @db.Uuid column — handing this straight to Prisma would otherwise throw
  // (P2007) instead of the clean 404 this guard exists to answer.
  const res = await call("GET", "not-a-uuid");
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: "Contact not found." });
  expect(db.contact.findFirst).not.toHaveBeenCalled();
});

it("404s a well-formed id that doesn't name a real contact", async () => {
  db.contact.findFirst.mockResolvedValue(null);
  const res = await call("GET", CONTACT_ID);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: "Contact not found." });
});

it("rejects an invalid phone on update before writing anything", async () => {
  const res = await call("PUT", CONTACT_ID, { phone: "123" });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: "Phone must contain exactly 10 digits." });
  expect(db.contact.update).not.toHaveBeenCalled();
});

it("answers a clean 409 (not 500) when an update collides with another contact's unique key", async () => {
  db.contact.update.mockRejectedValue(prismaKnownError("P2002"));
  const res = await call("PUT", CONTACT_ID, { email: "taken@example.com" });
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith({ message: "A record with that value already exists." });
});

it("answers a clean 404 (not 500) when a delete races an already-deleted row", async () => {
  db.contact.delete.mockRejectedValue(prismaKnownError("P2025"));
  const res = await call("DELETE", CONTACT_ID);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: "Record not found." });
});

it("falls back to a generic 500 for a genuinely unexpected error", async () => {
  db.contact.update.mockRejectedValue(new Error("connection reset"));
  const res = await call("PUT", CONTACT_ID, { firstName: "New" });
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: "Failed to process contact request." });
});
