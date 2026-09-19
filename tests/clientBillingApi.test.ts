import { beforeEach, expect, it, vi } from "vitest";

/**
 * /api/client/billing — the "Default" payment method badge.
 *
 * Verified against a real Stripe test client (via a test-clock renewal check) that a subscription
 * created with its own `default_payment_method` does not necessarily also set the *customer's*
 * `invoice_settings.default_payment_method` — that field was null there even though the
 * subscription's own default was correctly set and being charged every renewal. The badge must
 * fall back to the subscription's default so it doesn't go missing on an account that is billing
 * correctly underneath.
 */

const { requireSessionMock, clientFindFirst, customersRetrieve, paymentMethodsList, subscriptionsList, invoicesList, chargesList } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  clientFindFirst: vi.fn(),
  customersRetrieve: vi.fn(),
  paymentMethodsList: vi.fn(),
  subscriptionsList: vi.fn(),
  invoicesList: vi.fn(),
  chargesList: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireSession: requireSessionMock, requireRole: vi.fn() }));
// resolveBillingClient uses findFirst for a client session (resolveBillingClientById), not
// findMany (that path is for a staff member naming a company — resolveBillingClientByCompany).
vi.mock("@/lib/prisma", () => ({ prisma: { client: { findFirst: clientFindFirst } } }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { retrieve: customersRetrieve },
    paymentMethods: { list: paymentMethodsList },
    subscriptions: { list: subscriptionsList },
    invoices: { list: invoicesList },
    charges: { list: chargesList },
  },
}));

import handler from "@/pages/api/client/billing";

const CLIENT = { kind: "client", clientId: "cl1", companyId: "11111111-1111-4111-8111-111111111111", user: { id: "cu1" } };

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

const call = () => {
  const res = mockRes();
  return handler({ method: "GET", query: {}, headers: {} } as never, res as never).then(() => res);
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test";
  requireSessionMock.mockResolvedValue(CLIENT);
  clientFindFirst.mockResolvedValue({
    id: "cl1",
    name: "Acme",
    user_id: "cu1",
    client_billing: { stripe_customer_id: "cus_1", monthly_retainer_cents: 250000 },
  });
  paymentMethodsList.mockResolvedValue({ data: [{ id: "pm_1", type: "card", card: { brand: "visa", last4: "4242" } }] });
  invoicesList.mockReturnValue({ autoPagingToArray: async () => [] });
  chargesList.mockReturnValue({ autoPagingToArray: async () => [] });
});

it("falls back to the subscription's default_payment_method when the customer has none", async () => {
  customersRetrieve.mockResolvedValue({ id: "cus_1", invoice_settings: { default_payment_method: null } });
  subscriptionsList.mockResolvedValue({
    data: [{ id: "sub_1", status: "active", default_payment_method: "pm_1", items: { data: [{ price: {} }] } }],
  });

  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.body.paymentMethods[0].isDefault).toBe(true);
});

it("still prefers the customer-level default when one is set", async () => {
  customersRetrieve.mockResolvedValue({ id: "cus_1", invoice_settings: { default_payment_method: "pm_1" } });
  subscriptionsList.mockResolvedValue({
    data: [{ id: "sub_1", status: "active", default_payment_method: null, items: { data: [{ price: {} }] } }],
  });

  const res = await call();
  expect(res.body.paymentMethods[0].isDefault).toBe(true);
});

it("shows no default when neither the customer nor the subscription names one", async () => {
  customersRetrieve.mockResolvedValue({ id: "cus_1", invoice_settings: { default_payment_method: null } });
  subscriptionsList.mockResolvedValue({
    data: [{ id: "sub_1", status: "active", default_payment_method: null, items: { data: [{ price: {} }] } }],
  });

  const res = await call();
  expect(res.body.paymentMethods[0].isDefault).toBe(false);
});

/**
 * Pins the fix: the subscription lookup used to be one `status: "all", limit: 10` list + a
 * client-side find() for "active/trialing, else newest of any status" — a customer with more than
 * 10 subscriptions (stale canceled ones from testing, manual dashboard changes) could have the
 * true answer fall past that fixed page. It's now three status-filtered limit:1 calls instead.
 */
it("finds the active subscription via a status-filtered call, not a fixed-size page", async () => {
  customersRetrieve.mockResolvedValue({ id: "cus_1", invoice_settings: { default_payment_method: null } });
  const ACTIVE_SUB = { id: "sub_active", status: "active", default_payment_method: null, items: { data: [{ price: {} }] } };
  subscriptionsList.mockImplementation(async ({ status }: { status?: string }) => ({
    data: status === "active" ? [ACTIVE_SUB] : [],
  }));

  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.body.subscription.id).toBe("sub_active");
  expect(subscriptionsList).toHaveBeenCalledWith(expect.objectContaining({ status: "active", limit: 1 }));
  expect(subscriptionsList).toHaveBeenCalledWith(expect.objectContaining({ status: "trialing", limit: 1 }));
  expect(subscriptionsList).not.toHaveBeenCalledWith(expect.objectContaining({ status: "all" }));
});

it("falls back to the newest subscription of any status when none are active or trialing", async () => {
  customersRetrieve.mockResolvedValue({ id: "cus_1", invoice_settings: { default_payment_method: null } });
  const CANCELED_SUB = { id: "sub_old", status: "canceled", default_payment_method: null, items: { data: [{ price: {} }] } };
  subscriptionsList.mockImplementation(async ({ status }: { status?: string }) => ({
    data: status === "active" || status === "trialing" ? [] : [CANCELED_SUB],
  }));

  const res = await call();
  expect(res.body.subscription.id).toBe("sub_old");
});
