import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/client/connections — disconnecting a client's accounts from the staff-facing client view.
 *
 * The whole point of this route is scoping. Every route that already removed a connection was
 * scoped to `session.user.id`, so wiring the client page's buttons to one of those would have
 * revoked the STAFF member's own Google grant under the client's name. The tests below are about
 * that holding: the user id deleted from is the client's, the mailbox is matched on the client's
 * company, and a staff member gets no further than the role check.
 */

const {
  clientFindMany,
  tokenDeleteMany,
  mailboxDeleteMany,
  sessionMock,
  invalidateMock,
} = vi.hoisted(() => ({
  clientFindMany: vi.fn(),
  tokenDeleteMany: vi.fn(),
  mailboxDeleteMany: vi.fn(),
  sessionMock: vi.fn(),
  invalidateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: clientFindMany },
    platformToken: { deleteMany: tokenDeleteMany },
    emailProviderAccount: { deleteMany: mailboxDeleteMany },
  },
}));
// withAuth goes through requireRole, which both resolves the session and sends the 403 itself.
// Standing in for it here keeps the role gate in the test rather than assuming it.
vi.mock("@/lib/auth", () => ({
  requireSession: sessionMock,
  requireRole: vi.fn(async (_req: any, res: any, roles?: string[]) => {
    const session = await sessionMock();
    if (session?.kind !== "member" || (roles && !roles.includes(session.user.role))) {
      res.status(403).json({ message: "Forbidden" });
      return null;
    }
    return session;
  }),
}));
vi.mock("@/lib/email/mailboxAccess", () => ({ invalidateAccessibleAccountsCache: invalidateMock }));

import handler from "@/pages/api/client/connections";

const ADMIN = {
  kind: "member",
  user: { id: "staff1", email: "admin@vierradev.com", role: "admin", name: null },
  companyId: "vierra",
};

function mockRes() {
  const res: Record<string, unknown> & { statusCode: number; body: any } = {
    statusCode: 0,
    body: undefined,
  };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn(() => res);
  return res as unknown as { statusCode: number; body: any } & Record<string, ReturnType<typeof vi.fn>>;
}

const call = (body: unknown, query: Record<string, unknown> = { companyId: "co1" }) => {
  const res = mockRes();
  return handler(
    { method: "DELETE", query, headers: {}, body } as never,
    res as never
  ).then(() => res);
};

beforeEach(() => {
  clientFindMany
    .mockReset()
    .mockResolvedValue([{ id: "cl1", name: "Acme", user_id: "cu1", client_billing: null }]);
  tokenDeleteMany.mockReset().mockResolvedValue({ count: 1 });
  mailboxDeleteMany.mockReset().mockResolvedValue({ count: 1 });
  sessionMock.mockReset().mockResolvedValue(ADMIN);
  invalidateMock.mockReset();
});

describe("access", () => {
  it("takes DELETE and nothing else", async () => {
    const res = mockRes();
    await handler(
      { method: "POST", query: { companyId: "co1" }, headers: {}, body: {} } as never,
      res as never
    );
    expect(res.statusCode).toBe(405);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });

  it("refuses a staff session", async () => {
    sessionMock.mockResolvedValue({ ...ADMIN, user: { ...ADMIN.user, role: "staff" } });
    const res = await call({ kind: "google", value: "a@b.com" });
    expect(res.statusCode).toBe(403);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });

  it("refuses a client session outright", async () => {
    sessionMock.mockResolvedValue({ kind: "client", clientId: "cl1", companyId: "co1" });
    const res = await call({ kind: "google", value: "a@b.com" });
    expect(res.statusCode).toBe(403);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });

  it("needs a company named, rather than falling back to the staff member's own", async () => {
    const res = await call({ kind: "google", value: "a@b.com" }, {});
    expect(res.statusCode).toBe(400);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });
});

describe("google grants", () => {
  it("deletes the CLIENT's token, not the caller's", async () => {
    const res = await call({ kind: "google", value: "Person@Example.com " });
    expect(res.statusCode).toBe(200);
    expect(tokenDeleteMany).toHaveBeenCalledWith({
      where: { user_id: "cu1", platform: "gmail:person@example.com" },
    });
  });

  it("clears the client's mailbox-access cache, since the grant it cached is gone", async () => {
    await call({ kind: "google", value: "a@b.com" });
    expect(invalidateMock).toHaveBeenCalledWith("cu1");
  });

  it("reports a miss rather than a silent success", async () => {
    tokenDeleteMany.mockResolvedValue({ count: 0 });
    const res = await call({ kind: "google", value: "a@b.com" });
    expect(res.statusCode).toBe(404);
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("needs an address", async () => {
    const res = await call({ kind: "google", value: "   " });
    expect(res.statusCode).toBe(400);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });

  it("says so when the client has no login to hold a grant", async () => {
    clientFindMany.mockResolvedValue([{ id: "cl1", name: "Acme", user_id: null, client_billing: null }]);
    const res = await call({ kind: "google", value: "a@b.com" });
    expect(res.statusCode).toBe(400);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });
});

describe("social platforms", () => {
  it("deletes a known platform for the client", async () => {
    const res = await call({ kind: "platform", value: "linkedin" });
    expect(res.statusCode).toBe(200);
    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { user_id: "cu1", platform: "linkedin" } });
  });

  it("refuses a platform name it does not know, so the body cannot name any row", async () => {
    const res = await call({ kind: "platform", value: "gmail:victim@example.com" });
    expect(res.statusCode).toBe(400);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });
});

describe("mailboxes", () => {
  it("matches on the client's company, not on who is asking", async () => {
    const res = await call({ kind: "mailbox", value: "Desk@Acme.com" });
    expect(res.statusCode).toBe(200);
    expect(mailboxDeleteMany).toHaveBeenCalledWith({
      where: { company_id: "co1", account_email: "desk@acme.com" },
    });
  });

  it("works for a client with no login, since the mailbox belongs to the company", async () => {
    clientFindMany.mockResolvedValue([{ id: "cl1", name: "Acme", user_id: null, client_billing: null }]);
    const res = await call({ kind: "mailbox", value: "desk@acme.com" });
    expect(res.statusCode).toBe(200);
  });

  it("reports a miss", async () => {
    mailboxDeleteMany.mockResolvedValue({ count: 0 });
    const res = await call({ kind: "mailbox", value: "desk@acme.com" });
    expect(res.statusCode).toBe(404);
  });
});

describe("unknown input", () => {
  it("rejects a kind it does not handle", async () => {
    const res = await call({ kind: "password", value: "x" });
    expect(res.statusCode).toBe(400);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
    expect(mailboxDeleteMany).not.toHaveBeenCalled();
  });

  it("says so when the company has no client", async () => {
    clientFindMany.mockResolvedValue([]);
    const res = await call({ kind: "google", value: "a@b.com" });
    expect(res.statusCode).toBe(404);
  });
});
