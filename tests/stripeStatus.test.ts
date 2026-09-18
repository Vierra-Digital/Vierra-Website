import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * pages/api/stripe/status.ts. Covers the auth/validation branches, the "already connected" fast
 * path, the self-healing fallback that queries Stripe directly for a payment method when the
 * webhook hasn't landed yet, and that an unexpected failure returns a clean JSON 500 instead of
 * throwing (the fix this file pins).
 */

const { onboardingSessionFindUnique, clientBillingUpdate, paymentMethodsList, subscriptionsList } = vi.hoisted(() => ({
  onboardingSessionFindUnique: vi.fn(),
  clientBillingUpdate: vi.fn(),
  paymentMethodsList: vi.fn(),
  subscriptionsList: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingSession: { findUnique: onboardingSessionFindUnique },
    clientBilling: { update: clientBillingUpdate },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { paymentMethods: { list: paymentMethodsList }, subscriptions: { list: subscriptionsList } },
}));

import handler from "@/pages/api/stripe/status";

function mockReq(overrides: { query?: Record<string, string>; cookie?: string; method?: string } = {}) {
  return {
    method: overrides.method ?? "GET",
    headers: { cookie: overrides.cookie ?? "ob_session=tok1" },
    query: overrides.query ?? { session: "tok1" },
  };
}

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
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test";
  clientBillingUpdate.mockResolvedValue({});
  subscriptionsList.mockResolvedValue({ data: [] });
});

describe("GET /api/stripe/status", () => {
  it("405s a non-GET request", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }) as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it("503s distinctly when STRIPE_SECRET_KEY is missing, without touching the DB", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(onboardingSessionFindUnique).not.toHaveBeenCalled();
  });

  it("400s with no session query param", async () => {
    const res = mockRes();
    await handler(mockReq({ query: {} }) as never, res as never);
    expect(res.statusCode).toBe(400);
    expect((res.body as { connected: boolean }).connected).toBe(false);
  });

  it("403s when the ob_session cookie doesn't match", async () => {
    const res = mockRes();
    await handler(mockReq({ cookie: "ob_session=other" }) as never, res as never);
    expect(res.statusCode).toBe(403);
  });

  it("reports not connected when there's no Stripe customer on file", async () => {
    onboardingSessionFindUnique.mockResolvedValue({ clients: { id: "c1", client_billing: null } });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.body).toEqual({ connected: false });
    expect(paymentMethodsList).not.toHaveBeenCalled();
  });

  it("returns connected straight from the DB when stripe_connected is already true", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: {
        id: "c1",
        client_billing: {
          stripe_customer_id: "cus_1",
          stripe_connected: true,
          stripe_subscription_id: "sub_1",
          stripe_subscription_status: "active",
          stripe_card_brand: "visa",
          stripe_card_last4: "4242",
          stripe_connected_at: new Date("2026-01-01"),
        },
      },
    });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(paymentMethodsList).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ connected: true, cardBrand: "visa", cardLast4: "4242" });
  });

  it("self-heals by checking Stripe directly when the webhook hasn't updated the DB yet", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: {
        id: "c1",
        client_billing: {
          stripe_customer_id: "cus_1",
          stripe_connected: false,
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_card_brand: null,
          stripe_card_last4: null,
          stripe_connected_at: null,
        },
      },
    });
    paymentMethodsList.mockResolvedValue({ data: [{ id: "pm_1", card: { brand: "mastercard", last4: "1234" } }] });
    // The webhook that would normally record this (saveSubscriptionFromCheckout) is exactly what
    // hasn't landed yet — the self-heal path must look the subscription up itself rather than
    // leaving subscription_id/status null indefinitely.
    subscriptionsList.mockImplementation(async ({ status }: { status: string }) => ({
      data: status === "active" ? [{ id: "sub_1", status: "active" }] : [],
    }));
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(paymentMethodsList).toHaveBeenCalledWith({ customer: "cus_1", type: "card", limit: 1 });
    expect(clientBillingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripe_connected: true,
          stripe_payment_method_id: "pm_1",
          stripe_subscription_id: "sub_1",
          stripe_subscription_status: "active",
        }),
      })
    );
    expect(res.body).toMatchObject({
      connected: true,
      cardBrand: "mastercard",
      cardLast4: "1234",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
  });

  it("still flips stripe_connected even when Stripe has no subscription to report", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: {
        id: "c1",
        client_billing: {
          stripe_customer_id: "cus_1",
          stripe_connected: false,
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_card_brand: null,
          stripe_card_last4: null,
          stripe_connected_at: null,
        },
      },
    });
    paymentMethodsList.mockResolvedValue({ data: [{ id: "pm_1", card: { brand: "visa", last4: "4242" } }] });
    subscriptionsList.mockResolvedValue({ data: [] });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(clientBillingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ stripe_subscription_id: expect.anything() }),
      })
    );
    expect(res.body).toMatchObject({ connected: true, subscriptionId: null, subscriptionStatus: null });
  });

  it("reports not connected when Stripe has no payment method attached either", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: {
        id: "c1",
        client_billing: {
          stripe_customer_id: "cus_1",
          stripe_connected: false,
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_card_brand: null,
          stripe_card_last4: null,
          stripe_connected_at: null,
        },
      },
    });
    paymentMethodsList.mockResolvedValue({ data: [] });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.body).toEqual({ connected: false });
    expect(clientBillingUpdate).not.toHaveBeenCalled();
  });

  it("returns a clean 500 instead of throwing when Stripe fails unexpectedly", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: {
        id: "c1",
        client_billing: {
          stripe_customer_id: "cus_1",
          stripe_connected: false,
          stripe_subscription_id: null,
          stripe_subscription_status: null,
          stripe_card_brand: null,
          stripe_card_last4: null,
          stripe_connected_at: null,
        },
      },
    });
    paymentMethodsList.mockRejectedValue(new Error("stripe is down"));
    const res = mockRes();
    await expect(handler(mockReq() as never, res as never)).resolves.toBeUndefined();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Failed to check Stripe connection status." });
  });
});
