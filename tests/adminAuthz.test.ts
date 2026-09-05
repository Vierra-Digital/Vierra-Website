import { describe, it, expect, vi, beforeEach } from "vitest";

// Role model v2 (docs/ROLE_MODEL_REDESIGN.md): every Vierra staff/admin member may act on any
// client company's data — there's no more "caller's own company" to scope a lookup to (every
// staff session's own companyId is Vierra's fixed row, not any client's). deleteClient is the
// representative case: it looks up a client by id alone now, not company-scoped.
const { clientFindFirst, clientDelete, requireRoleMock } = vi.hoisted(() => ({
  clientFindFirst: vi.fn(),
  clientDelete: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { client: { findFirst: clientFindFirst, delete: clientDelete } },
}));
vi.mock("@/lib/auth", () => ({
  requireRole: requireRoleMock,
  requireSession: vi.fn(),
}));

import handler from "@/pages/api/admin/deleteClient";

const session = { kind: "member", user: { id: "u1", email: "a@x.com", role: "admin", name: null }, companyId: "companyA" };

function mockRes() {
  const res: Record<string, unknown> & { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn(() => res);
  return res as unknown as { statusCode: number; body: unknown } & Record<string, ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  clientFindFirst.mockReset();
  clientDelete.mockReset();
  requireRoleMock.mockReset().mockResolvedValue(session);
});

describe("admin/deleteClient — cross-client authz (role model v2)", () => {
  it("404s a nonexistent client id without deleting", async () => {
    clientFindFirst.mockResolvedValue(null);
    const req = { method: "DELETE", query: { clientId: "no-such-client" }, headers: {} } as never;
    const res = mockRes();
    await handler(req, res as never);
    expect(clientFindFirst).toHaveBeenCalledWith({
      where: { id: "no-such-client" },
    });
    expect(res.statusCode).toBe(404);
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it("deletes a client belonging to a different company than the caller's own — any Vierra admin may act on any client", async () => {
    clientFindFirst.mockResolvedValue({ id: "client-A", company_id: "some-other-client-company" });
    const req = { method: "DELETE", query: { clientId: "client-A" }, headers: {} } as never;
    const res = mockRes();
    await handler(req, res as never);
    expect(clientDelete).toHaveBeenCalledWith({ where: { id: "client-A" } });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a non-DELETE method before touching the database", async () => {
    const req = { method: "GET", query: {}, headers: {} } as never;
    const res = mockRes();
    await handler(req, res as never);
    expect(res.statusCode).toBe(405);
    expect(clientFindFirst).not.toHaveBeenCalled();
  });
});
