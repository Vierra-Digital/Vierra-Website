import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/contacts/bulk.ts — bulk delete/tag over a caller-supplied id list. Never had a route
 * test before. The id list and the tagId both come straight off the request body and used to
 * reach Prisma's @db.Uuid columns unvalidated; these pin the isUuid filtering that closes that.
 */

const db = vi.hoisted(() => ({
  contact: { findMany: vi.fn(), deleteMany: vi.fn() },
  contactTag: { findFirst: vi.fn() },
  contactTagAssignment: { createMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/contacts/xlsx", () => ({ syncContactsSpreadsheetForUser: vi.fn() }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/contacts/bulk";

const OWNED_ID = "33333333-3333-4333-8333-333333333333";
const TAG_ID = "44444444-4444-4444-8444-444444444444";

async function call(method: string, body: Record<string, unknown>) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ method, body, query: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.contact.findMany.mockResolvedValue([{ id: OWNED_ID }]);
});

it("400s when every id in the list is malformed, without querying the database", async () => {
  const res = await call("DELETE", { ids: ["not-a-uuid", "'; drop table contacts;--"] });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: "ids is required" });
  expect(db.contact.findMany).not.toHaveBeenCalled();
});

it("keeps only the well-formed ids from a mixed list before querying", async () => {
  await call("DELETE", { ids: ["not-a-uuid", OWNED_ID] });
  expect(db.contact.findMany).toHaveBeenCalledWith({
    where: { id: { in: [OWNED_ID] }, company_id: "company-1" },
    select: { id: true },
  });
});

it("404s when none of the well-formed ids belong to this company", async () => {
  db.contact.findMany.mockResolvedValue([]);
  const res = await call("DELETE", { ids: [OWNED_ID] });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(db.contact.deleteMany).not.toHaveBeenCalled();
});

it("400s a POST with a malformed tagId, without looking it up", async () => {
  const res = await call("POST", { ids: [OWNED_ID], tagId: "not-a-uuid" });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: "A valid tagId is required" });
  expect(db.contactTag.findFirst).not.toHaveBeenCalled();
});

it("404s a POST for a well-formed tagId that isn't one of the user's tags", async () => {
  db.contactTag.findFirst.mockResolvedValue(null);
  const res = await call("POST", { ids: [OWNED_ID], tagId: TAG_ID });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: "Tag not found." });
});

it("falls back to a generic 500 for a genuinely unexpected error, not a crash", async () => {
  db.contact.deleteMany.mockRejectedValue(new Error("connection reset"));
  const res = await call("DELETE", { ids: [OWNED_ID] });
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: "Failed to process bulk contact request." });
});
