import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/client/billing-subscription — a client toggling auto-renew (cancel_at_period_end).
 * Previously untested. Also pins the subscription-lookup fix (see billingPlanApi.test.ts /
 * clientBillingApi.test.ts for the same bug in sibling routes): a fixed-size "all"/limit:10 list +
 * client-side find() could miss the active subscription behind more than 10 stale/canceled ones.
 */

const { requireSessionMock, clientBillingFindUnique, clientBillingUpdate, subscriptionsList, subscriptionsUpdate } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  clientBillingFindUnique: vi.fn(),
  clientBillingUpdate: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireSession: requireSessionMock, requireRole: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { clientBilling: { findUnique: clientBillingFindUnique, update: clientBillingUpdate } },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { subscriptions: { list: subscriptionsList, update: subscriptionsUpdate } },
}));

import handler from "@/pages/api/client/billing-subscription";

const CLIENT_SESSION = { kind: "client", clientId: "cl1", companyId: "co1", user: { id: "u1" } };

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

const call = (body: Record<string, unknown>) => {
  const res = mockRes();
  return handler({ method: "POST", headers: {}, body } as never, res as never).then(() => res);
};

const ACTIVE_SUB = { id: "sub_active", status: "active", cancel_at_period_end: false };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test";
  requireSessionMock.mockResolvedValue(CLIENT_SESSION);
  clientBillingFindUnique.mockResolvedValue({ stripe_customer_id: "cus_1" });
  clientBillingUpdate.mockResolvedValue({});
  subscriptionsList.mockImplementation(async ({ status }: { status?: string }) => ({
    data: status === "active" ? [ACTIVE_SUB] : [],
  }));
  subscriptionsUpdate.mockResolvedValue({ id: "sub_active", status: "active", cancel_at_period_end: true });
});

describe("POST /api/client/billing-subscription", () => {
  it("405s a non-POST request", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it("403s a caller who isn't a client representative", async () => {
    requireSessionMock.mockResolvedValue({ kind: "member", companyId: "vierra" });
    const res = await call({ autoRenew: false });
    expect(res.statusCode).toBe(403);
  });

  it("400s a non-boolean autoRenew", async () => {
    const res = await call({ autoRenew: "no" });
    expect(res.statusCode).toBe(400);
  });

  it("404s when there's no billing account yet", async () => {
    clientBillingFindUnique.mockResolvedValue(null);
    const res = await call({ autoRenew: false });
    expect(res.statusCode).toBe(404);
  });

  it("finds the active subscription via a status-filtered call, not a fixed-size page", async () => {
    const res = await call({ autoRenew: false });
    expect(res.statusCode).toBe(200);
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_active", { cancel_at_period_end: true });
    expect(subscriptionsList).toHaveBeenCalledWith(expect.objectContaining({ status: "active", limit: 1 }));
    expect(subscriptionsList).toHaveBeenCalledWith(expect.objectContaining({ status: "trialing", limit: 1 }));
    expect(subscriptionsList).not.toHaveBeenCalledWith(expect.objectContaining({ status: "all" }));
  });

  it("404s rather than creating a subscription when none is active or trialing", async () => {
    subscriptionsList.mockResolvedValue({ data: [] });
    const res = await call({ autoRenew: false });
    expect(res.statusCode).toBe(404);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("persists the updated subscription id and status", async () => {
    await call({ autoRenew: true });
    expect(clientBillingUpdate).toHaveBeenCalledWith({
      where: { client_id: "cl1" },
      data: { stripe_subscription_id: "sub_active", stripe_subscription_status: "active" },
    });
  });
});
