import { describe, it, expect, vi, beforeEach } from "vitest";

// Guards the cross-tenant IDOR class: admin endpoints must scope resource lookups to the caller's
// own company. deleteClient is the representative case (findFirst scoped by company_id -> delete).
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

describe("admin/deleteClient — cross-tenant authz", () => {
  it("scopes the lookup to the caller's company and 404s another company's client without deleting", async () => {
    clientFindFirst.mockResolvedValue(null); // a client id from company B doesn't match the scope
    const req = { method: "DELETE", query: { clientId: "client-in-company-B" }, headers: {} } as never;
    const res = mockRes();
    await handler(req, res as never);
    expect(clientFindFirst).toHaveBeenCalledWith({
      where: { id: "client-in-company-B", company_id: "companyA" },
    });
    expect(res.statusCode).toBe(404);
    expect(clientDelete).not.toHaveBeenCalled();
  });

  it("deletes when the client belongs to the caller's company", async () => {
    clientFindFirst.mockResolvedValue({ id: "client-A", company_id: "companyA" });
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
