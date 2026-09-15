import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/stripe/webhook — idempotency (a redelivered event.id is a no-op) and the invoice.paid /
 * invoice.payment_failed sync into stripe_invoices, added alongside the pre-existing
 * checkout/setup-intent/subscription-status handling.
 *
 * A thrown error inside a handler branch must 500 (so Stripe retries), not throw unhandled — and
 * must not record the event as seen, since it wasn't actually processed.
 */

const {
  constructEventMock,
  webhookEventFindUnique,
  webhookEventCreate,
  clientBillingUpdateMany,
  clientBillingFindFirst,
  stripeInvoiceUpsert,
  paymentMethodsList,
  subscriptionsRetrieve,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  webhookEventFindUnique: vi.fn(),
  webhookEventCreate: vi.fn(),
  clientBillingUpdateMany: vi.fn(),
  clientBillingFindFirst: vi.fn(),
  stripeInvoiceUpsert: vi.fn(),
  paymentMethodsList: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: constructEventMock },
    paymentMethods: { list: paymentMethodsList },
    subscriptions: { retrieve: subscriptionsRetrieve },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stripeWebhookEvent: { findUnique: webhookEventFindUnique, create: webhookEventCreate },
    clientBilling: { updateMany: clientBillingUpdateMany, findFirst: clientBillingFindFirst },
    stripeInvoice: { upsert: stripeInvoiceUpsert },
  },
}));

import handler from "@/pages/api/stripe/webhook";

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

/** getRawBody iterates the request as an async iterable of chunks. */
function mockReq(body: string) {
  return {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(body);
    },
  };
}

const call = (event: unknown) => {
  constructEventMock.mockReturnValue(event);
  const req = mockReq("{}");
  const res = mockRes();
  return handler(req as never, res as never).then(() => res);
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  webhookEventFindUnique.mockResolvedValue(null);
  webhookEventCreate.mockResolvedValue({});
  clientBillingUpdateMany.mockResolvedValue({ count: 1 });
  clientBillingFindFirst.mockResolvedValue({ client_id: "cl1", clients: { company_id: "co1" } });
  stripeInvoiceUpsert.mockResolvedValue({});
});

describe("idempotency", () => {
  it("skips reprocessing a redelivered event.id", async () => {
    webhookEventFindUnique.mockResolvedValue({ id: "row1", stripe_event_id: "evt_1" });
    const res = await call({ id: "evt_1", type: "customer.subscription.updated", data: { object: {} } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ duplicate: true });
    expect(clientBillingUpdateMany).not.toHaveBeenCalled();
    expect(webhookEventCreate).not.toHaveBeenCalled();
  });

  it("records a newly processed event so a later redelivery is caught", async () => {
    const event = {
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active" } },
    };
    const res = await call(event);
    expect(res.statusCode).toBe(200);
    expect(webhookEventCreate).toHaveBeenCalledWith({
      data: { stripe_event_id: "evt_2", event_type: "customer.subscription.updated" },
    });
  });
});

describe("invoice sync", () => {
  const invoice = {
    id: "in_1",
    customer: "cus_1",
    status: "paid",
    amount_due: 10000,
    amount_paid: 10000,
    currency: "usd",
    created: 1700000000,
    hosted_invoice_url: "https://stripe.test/in_1",
    lines: { data: [{ period: { start: 1700000000, end: 1702592000 } }] },
    parent: { subscription_details: { subscription: "sub_1" } },
  };

  it("invoice.paid upserts a stripe_invoices row for the matching client", async () => {
    const res = await call({ id: "evt_3", type: "invoice.paid", data: { object: invoice } });
    expect(res.statusCode).toBe(200);
    expect(stripeInvoiceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "in_1" },
        create: expect.objectContaining({
          id: "in_1",
          client_id: "cl1",
          company_id: "co1",
          status: "paid",
          amount_paid_cents: 10000,
        }),
      })
    );
  });

  it("skips rather than throws when no client_billing matches the customer", async () => {
    clientBillingFindFirst.mockResolvedValue(null);
    const res = await call({ id: "evt_4", type: "invoice.payment_failed", data: { object: invoice } });
    expect(res.statusCode).toBe(200);
    expect(stripeInvoiceUpsert).not.toHaveBeenCalled();
    // A skip is not a processing failure — the event is still recorded as seen.
    expect(webhookEventCreate).toHaveBeenCalled();
  });
});

describe("failure", () => {
  it("500s and does not record the event when a handler branch throws", async () => {
    clientBillingUpdateMany.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({
      id: "evt_5",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active" } },
    });
    expect(res.statusCode).toBe(500);
    expect(webhookEventCreate).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("signature verification", () => {
  it("400s on a bad signature without touching the database", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const req = mockReq("{}");
    const res = mockRes();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(webhookEventFindUnique).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
