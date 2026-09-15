import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/client/billing-plan — admin-only plan changes. Applies at next renewal (proration_behavior
 * "none"), never prorated immediately, and updates monthly_retainer_cents to match. See
 * pages/api/client/billing-plan.ts for why no "pending" state is needed for that to work.
 */

const {
  requireRoleMock,
  clientFindMany,
  clientFindUnique,
  clientBillingUpdate,
  subscriptionsList,
  subscriptionsUpdate,
  getRetainerProductIdMock,
  sendPlanChangeEmailMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  clientFindMany: vi.fn(),
  clientFindUnique: vi.fn(),
  clientBillingUpdate: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  getRetainerProductIdMock: vi.fn(),
  sendPlanChangeEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: requireRoleMock, requireSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findMany: clientFindMany, findUnique: clientFindUnique },
    clientBilling: { update: clientBillingUpdate },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { list: subscriptionsList, update: subscriptionsUpdate },
  },
}));
vi.mock("@/lib/stripe/retainerProduct", () => ({ getRetainerProductId: getRetainerProductIdMock }));
vi.mock("@/lib/emailSender", () => ({ sendPlanChangeEmail: sendPlanChangeEmailMock }));

import handler from "@/pages/api/client/billing-plan";

const ADMIN = { kind: "member", user: { id: "staff1", role: "admin" }, companyId: "vierra" };

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

const CLIENT_ROW = {
  id: "cl1",
  name: "Acme",
  user_id: null,
  client_billing: { stripe_customer_id: "cus_1", monthly_retainer_cents: 100000 },
};

const call = (req: Record<string, unknown>) => {
  const res = mockRes();
  return handler({ method: "PUT", query: { companyId: "11111111-1111-4111-8111-111111111111" }, headers: {}, body: {}, ...req } as never, res as never).then(
    () => res
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test";
  requireRoleMock.mockResolvedValue(ADMIN);
  clientFindMany.mockResolvedValue([CLIENT_ROW]);
  clientFindUnique.mockResolvedValue({ email: "client@acme.co", name: "Acme Rep" });
  clientBillingUpdate.mockResolvedValue({});
  getRetainerProductIdMock.mockResolvedValue("prod_retainer");
  sendPlanChangeEmailMock.mockResolvedValue(undefined);
  subscriptionsList.mockResolvedValue({
    data: [
      {
        id: "sub_1",
        status: "active",
        items: { data: [{ id: "si_1", price: { unit_amount: 100000 }, current_period_end: 1700000000 }] },
      },
    ],
  });
  subscriptionsUpdate.mockResolvedValue({
    id: "sub_1",
    items: { data: [{ current_period_end: 1702592000 }] },
  });
});

describe("access", () => {
  it("only accepts PUT", async () => {
    const res = await call({ method: "GET" });
    expect(res.statusCode).toBe(405);
  });

  it("non-admin is refused before any billing work happens", async () => {
    requireRoleMock.mockResolvedValue(null);
    await call({});
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("400s when a staff member has not named a company", async () => {
    const res = await call({ query: {} });
    expect(res.statusCode).toBe(400);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  it("rejects a non-positive amount", async () => {
    const res = await call({ body: { newRetainerCents: 0 } });
    expect(res.statusCode).toBe(400);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-integer amount", async () => {
    const res = await call({ body: { newRetainerCents: 199.5 } });
    expect(res.statusCode).toBe(400);
  });
});

describe("happy path", () => {
  it("swaps the subscription item price with no proration, and updates monthly_retainer_cents", async () => {
    const res = await call({ body: { newRetainerCents: 150000 } });
    expect(res.statusCode).toBe(200);
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        proration_behavior: "none",
        items: [
          expect.objectContaining({
            id: "si_1",
            price_data: expect.objectContaining({ unit_amount: 150000, product: "prod_retainer" }),
          }),
        ],
      })
    );
    expect(clientBillingUpdate).toHaveBeenCalledWith({
      where: { client_id: "cl1" },
      data: { monthly_retainer_cents: 150000 },
    });
  });

  it("emails the client with the old and new amounts", async () => {
    await call({ body: { newRetainerCents: 150000 } });
    expect(sendPlanChangeEmailMock).toHaveBeenCalledWith(
      "client@acme.co",
      expect.objectContaining({ oldAmountCents: 100000, newAmountCents: 150000 })
    );
  });

  it("still reports success even if the notification email fails", async () => {
    sendPlanChangeEmailMock.mockRejectedValue(new Error("smtp down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ body: { newRetainerCents: 150000 } });
    expect(res.statusCode).toBe(200);
    err.mockRestore();
  });
});

describe("DB write fails after Stripe already changed", () => {
  it("reverts the Stripe price back to the old amount and reports failure, not 200", async () => {
    clientBillingUpdate.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call({ body: { newRetainerCents: 150000 } });

    expect(res.statusCode).toBe(502);
    // First call is the intended change to 150000; second is the revert back to the original
    // 100000 — both against the same subscription item, so Stripe and our DB stay in agreement.
    expect(subscriptionsUpdate).toHaveBeenCalledTimes(2);
    expect(subscriptionsUpdate).toHaveBeenNthCalledWith(
      2,
      "sub_1",
      expect.objectContaining({
        proration_behavior: "none",
        items: [expect.objectContaining({ id: "si_1", price_data: expect.objectContaining({ unit_amount: 100000 }) })],
      })
    );
    // Nothing to notify the client about — the change never actually stuck.
    expect(sendPlanChangeEmailMock).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("still reports failure even if the revert itself fails", async () => {
    clientBillingUpdate.mockRejectedValue(new Error("db down"));
    subscriptionsUpdate.mockImplementationOnce(async () => ({
      id: "sub_1",
      items: { data: [{ current_period_end: 1702592000 }] },
    })).mockRejectedValueOnce(new Error("stripe also down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call({ body: { newRetainerCents: 150000 } });

    expect(res.statusCode).toBe(502);
    err.mockRestore();
  });
});

describe("no active subscription", () => {
  it("404s rather than creating a subscription", async () => {
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_old", status: "canceled", items: { data: [] } }] });
    const res = await call({ body: { newRetainerCents: 150000 } });
    expect(res.statusCode).toBe(404);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });
});
