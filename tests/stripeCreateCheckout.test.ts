import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * pages/api/stripe/create-checkout.ts. Covers the auth/validation branches, the existing- vs
 * new-customer paths, and that an unexpected Stripe/Prisma failure now returns a clean JSON 500
 * via handleApiError instead of an unhandled exception (the fix this file pins).
 */

const { onboardingSessionFindUnique, clientBillingUpsert, customersCreate, checkoutSessionsCreate, getRetainerProductIdMock } = vi.hoisted(() => ({
  onboardingSessionFindUnique: vi.fn(),
  clientBillingUpsert: vi.fn(),
  customersCreate: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
  getRetainerProductIdMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingSession: { findUnique: onboardingSessionFindUnique },
    clientBilling: { upsert: clientBillingUpsert },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: customersCreate },
    checkout: { sessions: { create: checkoutSessionsCreate } },
  },
}));

vi.mock("@/lib/stripe/retainerProduct", () => ({ getRetainerProductId: getRetainerProductIdMock }));

import handler from "@/pages/api/stripe/create-checkout";

function mockReq(overrides: { body?: unknown; cookie?: string; method?: string } = {}) {
  return {
    method: overrides.method ?? "POST",
    headers: { cookie: overrides.cookie ?? "ob_session=tok1" },
    body: overrides.body ?? { onboardingToken: "tok1" },
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

const client = {
  id: "client1",
  name: "Jane Rep",
  email: "jane@client.com",
  business_name: "Client Co",
  client_billing: { monthly_retainer_cents: 150000, stripe_customer_id: null as string | null },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test";
  onboardingSessionFindUnique.mockResolvedValue({ clients: client });
  clientBillingUpsert.mockResolvedValue({});
  customersCreate.mockResolvedValue({ id: "cus_new" });
  checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test_1" });
  getRetainerProductIdMock.mockResolvedValue("prod_retainer");
});

describe("POST /api/stripe/create-checkout", () => {
  it("405s a non-POST request", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "GET" }) as never, res as never);
    expect(res.statusCode).toBe(405);
  });

  it("503s distinctly when STRIPE_SECRET_KEY is missing, without touching the DB", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(onboardingSessionFindUnique).not.toHaveBeenCalled();
  });

  it("400s with no onboardingToken", async () => {
    const res = mockRes();
    await handler(mockReq({ body: {} }) as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it("403s when the ob_session cookie doesn't match the token", async () => {
    const res = mockRes();
    await handler(mockReq({ cookie: "ob_session=someone-elses-token" }) as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(onboardingSessionFindUnique).not.toHaveBeenCalled();
  });

  it("404s when the onboarding session has no client", async () => {
    onboardingSessionFindUnique.mockResolvedValue(null);
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.statusCode).toBe(404);
  });

  it("400s when the client has no monthly retainer set", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: { ...client, client_billing: { monthly_retainer_cents: 0, stripe_customer_id: null } },
    });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("creates a new Stripe customer and persists it when the client has none yet", async () => {
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: client.name, email: client.email })
    );
    expect(clientBillingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { client_id: client.id } })
    );
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new", line_items: [expect.objectContaining({ price_data: expect.objectContaining({ product: "prod_retainer" }) })] })
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { url: string }).url).toBe("https://checkout.stripe.com/pay/cs_test_1");
  });

  it("reuses an existing Stripe customer instead of creating a new one", async () => {
    onboardingSessionFindUnique.mockResolvedValue({
      clients: { ...client, client_billing: { monthly_retainer_cents: 150000, stripe_customer_id: "cus_existing" } },
    });
    const res = mockRes();
    await handler(mockReq() as never, res as never);
    expect(customersCreate).not.toHaveBeenCalled();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
  });

  it("returns a clean 500 instead of throwing when Stripe fails unexpectedly", async () => {
    checkoutSessionsCreate.mockRejectedValue(new Error("stripe is down"));
    const res = mockRes();
    await expect(handler(mockReq() as never, res as never)).resolves.toBeUndefined();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Failed to create checkout session." });
  });
});
