import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Revenue now reads from stripe_invoices (synced by the webhook), not finance_entries' "revenue"
 * kind — nothing ever wrote that column, so every one of these three read-sites returned $0
 * before. All three must agree by reading the same table; none may still touch finance_entries
 * with kind: "revenue", and finances/overview.ts must no longer make a live Stripe call.
 */

const {
  requireRoleMock,
  financeEntryFindMany,
  financeEntryAggregate,
  stripeInvoiceFindMany,
  stripeInvoiceAggregate,
  clientFindManyMock,
  clientCountMock,
  marketingTrackerGroupBy,
  campaignCountMock,
  campaignContactCountMock,
  requireSessionMock,
  campaignFindManyMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  financeEntryFindMany: vi.fn(),
  financeEntryAggregate: vi.fn(),
  stripeInvoiceFindMany: vi.fn(),
  stripeInvoiceAggregate: vi.fn(),
  clientFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  marketingTrackerGroupBy: vi.fn(),
  campaignCountMock: vi.fn(),
  campaignContactCountMock: vi.fn(),
  requireSessionMock: vi.fn(),
  campaignFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: requireRoleMock, requireSession: requireSessionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    financeEntry: { findMany: financeEntryFindMany, aggregate: financeEntryAggregate },
    stripeInvoice: { findMany: stripeInvoiceFindMany, aggregate: stripeInvoiceAggregate },
    client: { findMany: clientFindManyMock, count: clientCountMock },
    marketingTracker: { groupBy: marketingTrackerGroupBy },
    campaign: { count: campaignCountMock, findMany: campaignFindManyMock },
    campaignContact: { count: campaignContactCountMock },
  },
}));

function mockRes() {
  const res: Record<string, unknown> & { statusCode: number; body: any } = { statusCode: 0, body: undefined };
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

const ADMIN = { kind: "member", user: { id: "staff1", role: "admin" }, companyId: "vierra" };

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(ADMIN);
  requireSessionMock.mockResolvedValue(ADMIN);
  financeEntryFindMany.mockResolvedValue([]);
  financeEntryAggregate.mockResolvedValue({ _sum: { amount_cents: 0 } });
  stripeInvoiceFindMany.mockResolvedValue([{ amount_paid_cents: 50000, created_at: new Date("2026-03-15") }]);
  stripeInvoiceAggregate.mockResolvedValue({ _sum: { amount_paid_cents: 50000 } });
  clientFindManyMock.mockResolvedValue([]);
  clientCountMock.mockResolvedValue(0);
  marketingTrackerGroupBy.mockResolvedValue([]);
  campaignCountMock.mockResolvedValue(0);
  campaignContactCountMock.mockResolvedValue(0);
  campaignFindManyMock.mockResolvedValue([]);
});

describe("finances/overview: revenue from stripe_invoices", () => {
  it("reads stripe_invoices for revenue and finance_entries filtered to expense only", async () => {
    const { default: handler } = await import("@/pages/api/finances/overview");
    const res = mockRes();
    await handler({ method: "GET", query: { year: "2026" }, headers: {} } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(financeEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: "expense" }) })
    );
    expect(stripeInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "paid" }) })
    );
    expect(res.body.totals.revenueCents).toBe(50000);
    expect(res.body.collected.totalCents).toBe(50000);
  });
});

describe("finances/overview: Ledger includes both revenue and expense rows", () => {
  it("merges paid invoices and expense entries into one chronological ledger", async () => {
    financeEntryFindMany.mockResolvedValue([
      { id: "fe_1", kind: "expense", amount_cents: 20000, occurred_at: new Date("2026-03-10"), note: "AWS" },
    ]);
    stripeInvoiceFindMany.mockResolvedValue([
      {
        id: "in_1",
        client_id: "client_1",
        amount_paid_cents: 50000,
        created_at: new Date("2026-03-15"),
      },
    ]);
    clientFindManyMock.mockResolvedValue([{ id: "client_1", name: "Jane", business_name: "Acme Co" }]);

    const { default: handler } = await import("@/pages/api/finances/overview");
    const res = mockRes();
    await handler({ method: "GET", query: { year: "2026" }, headers: {} } as never, res as never);

    expect(res.body.entries).toHaveLength(2);
    // Newest first: the invoice's created_at (3/15) is after the expense's occurred_at (3/10) —
    // dated by created_at, the same field the month chart buckets by, not paid_at.
    expect(res.body.entries[0]).toMatchObject({
      id: "in_1",
      kind: "revenue",
      amountCents: 50000,
      note: "Acme Co",
    });
    expect(res.body.entries[1]).toMatchObject({ id: "fe_1", kind: "expense", amountCents: 20000, note: "AWS" });
  });

  it("still names a revenue row for a client that is no longer active", async () => {
    // The `clients` query used for the MRR/contracted list is filtered to is_active: true; the
    // ledger's client-name lookup must not reuse it, or a churned client's past invoices would
    // show no name.
    stripeInvoiceFindMany.mockResolvedValue([
      { id: "in_1", client_id: "client_churned", amount_paid_cents: 30000, created_at: new Date("2026-03-01") },
    ]);
    clientFindManyMock.mockImplementation(async ({ where }: { where?: { is_active?: boolean } }) =>
      where?.is_active ? [] : [{ id: "client_churned", name: "Old Client", business_name: "Old Co" }]
    );

    const { default: handler } = await import("@/pages/api/finances/overview");
    const res = mockRes();
    await handler({ method: "GET", query: { year: "2026" }, headers: {} } as never, res as never);

    expect(res.body.entries[0]).toMatchObject({ id: "in_1", note: "Old Co" });
  });
});

describe("dashboard/stats: Revenue tile from stripe_invoices", () => {
  it("sums stripe_invoices for the revenue card, finance_entries for expenses only", async () => {
    const { default: handler } = await import("@/pages/api/dashboard/stats");
    const res = mockRes();
    await handler({ method: "GET", query: {}, headers: {} } as never, res as never);

    expect(stripeInvoiceAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "paid" }) })
    );
    expect(financeEntryAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: "expense" }) })
    );
    const revenueCard = res.body.stats.find((s: { key: string }) => s.key === "revenue");
    expect(revenueCard.currentMonthValue).toBe(500);
  });
});

describe("client/overview: billedCents from stripe_invoices", () => {
  it("sums stripe_invoices rather than finance_entries", async () => {
    const { default: handler } = await import("@/pages/api/client/overview");
    const res = mockRes();
    await handler(
      { method: "GET", query: { companyId: "11111111-1111-4111-8111-111111111111" }, headers: {} } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(stripeInvoiceAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "paid" }) })
    );
    expect(financeEntryAggregate).not.toHaveBeenCalled();
    expect(res.body.analytics.billedCents).toBe(50000);
  });
});
