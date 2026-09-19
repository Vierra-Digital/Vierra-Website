import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cartographyContact: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));
import { requireRole } from "@/lib/auth";
import list from "@/pages/api/cartography/contacts";
import promote from "@/pages/api/cartography/contacts/promote";
import edit from "@/pages/api/cartography/contacts/[id]";

// resolveTargetCompanyId and the promote/[id] routes now require an explicit companyId or
// candidate id to be UUID-shaped (both are @db.Uuid columns — see lib/api/targetCompany.ts and
// pages/api/cartography/contacts/{promote,[id]}.ts), so these stand-ins must look like real
// UUIDs, not the short mnemonic strings still used elsewhere in this file for ids that are never
// validated (session.companyId, user ids).
const CONTRIBUTOR_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_COMPANY_ID = "22222222-2222-2222-2222-222222222222";
const CANDIDATE_ID = "33333333-3333-3333-3333-333333333333";

const candidate = {
  id: CANDIDATE_ID, company_id: CONTRIBUTOR_COMPANY_ID, status: "candidate", email: "LEAD@example.com",
  name: "Jane Doe", cartography_companies: { name: "Shared business" },
};
function session(userId: string) {
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member", companyId: userId,
    user: { id: userId, role: "staff", email: "staff@example.com", name: null },
  });
}
async function call(handler: typeof list, method: string, body = {}, query = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
  await handler({ method, body, query } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}
beforeEach(() => {
  vi.resetAllMocks();
  session("reader");
  db.cartographyContact.findUnique.mockResolvedValue(candidate);
  db.contact.create.mockResolvedValue({ id: "imported" });
});

it("lists shared candidates with read-only fields for other companies", async () => {
  db.cartographyContact.findMany.mockResolvedValue([candidate]);
  const res = await call(list, "GET");
  expect(db.cartographyContact.findMany.mock.calls[0][0].where).toEqual({ status: { in: ["candidate", "reviewed", "promoted"] } });
  expect(res.json).toHaveBeenCalledWith({ results: [expect.objectContaining({ id: CANDIDATE_ID, canEdit: false })] });
});

it("allows the contributor to edit its candidates", async () => {
  session("contributor");
  db.cartographyContact.findMany.mockResolvedValue([candidate]);
  const res = await call(list, "GET", {}, { companyId: CONTRIBUTOR_COMPANY_ID });
  expect(res.json).toHaveBeenCalledWith({ results: [expect.objectContaining({ canEdit: true })] });
});

it("imports the same shared candidate for two users without consuming the source", async () => {
  for (const userId of ["reader-a", "reader-b"]) {
    session(userId);
    const res = await call(promote, "POST", { ids: [candidate.id], companyId: TARGET_COMPANY_ID });
    expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "imported" }] });
    expect(db.contact.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ company_id: TARGET_COMPANY_ID, user_id: userId, email: "lead@example.com" }),
    });
  }
  expect(db.cartographyContact.update).not.toHaveBeenCalled();
});

it("reuses the caller's existing contact on repeated import", async () => {
  db.contact.findFirst.mockResolvedValue({ id: "existing" });
  const res = await call(promote, "POST", { ids: [candidate.id], companyId: TARGET_COMPANY_ID });
  expect(db.contact.findFirst).toHaveBeenCalledWith({ where: { company_id: TARGET_COMPANY_ID, email: "lead@example.com" } });
  expect(db.contact.create).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "existing" }] });
});

it("allows importing a candidate promoted by the legacy workflow", async () => {
  db.cartographyContact.findUnique.mockResolvedValue({ ...candidate, status: "promoted" });
  await call(promote, "POST", { ids: [candidate.id], companyId: TARGET_COMPANY_ID });
  expect(db.contact.create).toHaveBeenCalledOnce();
});

it.each(["rejected", "duplicate"])("does not import a %s candidate", async (status) => {
  db.cartographyContact.findUnique.mockResolvedValue({ ...candidate, status });
  await call(promote, "POST", { ids: [candidate.id], companyId: TARGET_COMPANY_ID });
  expect(db.contact.create).not.toHaveBeenCalled();
});

it("treats a malformed (non-UUID) explicit companyId the same as none given", async () => {
  const res = await call(promote, "POST", { ids: [candidate.id], companyId: "not-a-real-uuid" });
  expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "imported" }] });
  // Falls back to the caller's own (Vierra) companyId, same as if nothing were sent at all —
  // never handed to Prisma raw.
  expect(db.contact.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ company_id: "reader" }),
  });
});

it("defaults to the caller's own (Vierra) company when no target companyId is given", async () => {
  const res = await call(promote, "POST", { ids: [candidate.id] });
  expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "imported" }] });
  expect(db.contact.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ company_id: "reader" }),
  });
});

it("does not allow editing another company's shared candidate", async () => {
  const res = await call(edit, "PATCH", { name: "Changed" }, { id: candidate.id });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(db.cartographyContact.update).not.toHaveBeenCalled();
});

it("requires authentication to list or import candidates", async () => {
  vi.mocked(requireRole).mockResolvedValue(null);
  await call(list, "GET");
  await call(promote, "POST", { ids: [candidate.id] });
  expect(db.cartographyContact.findMany).not.toHaveBeenCalled();
  expect(db.contact.create).not.toHaveBeenCalled();
});
