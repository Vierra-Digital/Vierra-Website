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

const candidate = {
  id: "candidate", company_id: "contributor", status: "candidate", email: "LEAD@example.com",
  name: "Jane Doe", cartography_companies: { name: "Shared business" },
};
function session(userId: string) {
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member", companyId: userId,
    user: { id: userId, role: "staff", email: "staff@example.com", name: null, isPlatformAdmin: false },
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
  expect(res.json).toHaveBeenCalledWith({ results: [expect.objectContaining({ id: "candidate", canEdit: false })] });
});

it("allows the contributor to edit its candidates", async () => {
  session("contributor");
  db.cartographyContact.findMany.mockResolvedValue([candidate]);
  const res = await call(list, "GET");
  expect(res.json).toHaveBeenCalledWith({ results: [expect.objectContaining({ canEdit: true })] });
});

it("imports the same shared candidate for two users without consuming the source", async () => {
  for (const userId of ["reader-a", "reader-b"]) {
    session(userId);
    const res = await call(promote, "POST", { ids: [candidate.id] });
    expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "imported" }] });
    expect(db.contact.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ user_id: userId, email: "lead@example.com" }) });
  }
  expect(db.cartographyContact.update).not.toHaveBeenCalled();
});

it("reuses the caller's existing contact on repeated import", async () => {
  db.contact.findFirst.mockResolvedValue({ id: "existing" });
  const res = await call(promote, "POST", { ids: [candidate.id] });
  expect(db.contact.findFirst).toHaveBeenCalledWith({ where: { user_id: "reader", email: "lead@example.com" } });
  expect(db.contact.create).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ results: [{ id: candidate.id, ok: true, contactId: "existing" }] });
});

it("allows importing a candidate promoted by the legacy workflow", async () => {
  db.cartographyContact.findUnique.mockResolvedValue({ ...candidate, status: "promoted" });
  await call(promote, "POST", { ids: [candidate.id] });
  expect(db.contact.create).toHaveBeenCalledOnce();
});

it.each(["rejected", "duplicate"])("does not import a %s candidate", async (status) => {
  db.cartographyContact.findUnique.mockResolvedValue({ ...candidate, status });
  await call(promote, "POST", { ids: [candidate.id] });
  expect(db.contact.create).not.toHaveBeenCalled();
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
