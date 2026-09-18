import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/stripe/webhook — idempotency and the invoice.paid/invoice.payment_failed sync into
 * stripe_invoices, added alongside the pre-existing checkout/setup-intent/subscription-status
 * handling.
 *
 * Idempotency claims the event.id via the create() call itself (a unique-constraint violation IS
 * the duplicate signal), not a separate find-then-create — a genuinely concurrent duplicate
 * delivery would otherwise pass a find before either request had inserted, reprocessing the event
 * twice. A processing failure releases the claim (deletes the row) before 500ing, so a Stripe
 * retry reprocesses rather than being swallowed as an already-seen duplicate.
 */

function prismaUniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

const {
  constructEventMock,
  webhookEventCreate,
  webhookEventDelete,
  clientBillingUpdateMany,
  clientBillingFindFirst,
  stripeInvoiceUpsert,
  paymentMethodsList,
  subscriptionsRetrieve,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  webhookEventCreate: vi.fn(),
  webhookEventDelete: vi.fn(),
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
    stripeWebhookEvent: { create: webhookEventCreate, delete: webhookEventDelete },
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
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  webhookEventCreate.mockResolvedValue({});
  webhookEventDelete.mockResolvedValue({});
  clientBillingUpdateMany.mockResolvedValue({ count: 1 });
  clientBillingFindFirst.mockResolvedValue({ client_id: "cl1", clients: { company_id: "co1" } });
  stripeInvoiceUpsert.mockResolvedValue({});
});

describe("idempotency", () => {
  it("claims the event by inserting first, before any processing", async () => {
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
    // Claimed before the handler ran — this call ordering is what makes a concurrent duplicate
    // delivery safe (the loser's create() hits the unique constraint before doing any work).
    expect(webhookEventCreate.mock.invocationCallOrder[0]).toBeLessThan(clientBillingUpdateMany.mock.invocationCallOrder[0]);
  });

  it("treats a unique-constraint violation on the claim as a duplicate, without reprocessing", async () => {
    webhookEventCreate.mockRejectedValue(prismaUniqueViolation());
    const res = await call({ id: "evt_1", type: "customer.subscription.updated", data: { object: {} } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ duplicate: true });
    expect(clientBillingUpdateMany).not.toHaveBeenCalled();
  });

  it("500s and logs (not throws) if recording the claim fails for a non-duplicate reason", async () => {
    webhookEventCreate.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ id: "evt_9", type: "customer.subscription.updated", data: { object: {} } });
    expect(res.statusCode).toBe(500);
    expect(clientBillingUpdateMany).not.toHaveBeenCalled();
    err.mockRestore();
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
    // Stripe's own record of when the invoice was actually paid — distinct from `created`, and
    // from whenever this webhook happens to process the event (see the fix pinned below).
    status_transitions: { paid_at: 1700003600 },
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

  it("stamps paid_at from Stripe's status_transitions.paid_at, not wall-clock processing time", async () => {
    await call({ id: "evt_paid_at", type: "invoice.paid", data: { object: invoice } });
    const call1 = stripeInvoiceUpsert.mock.calls[0][0];
    expect(call1.create.paid_at).toEqual(new Date(1700003600 * 1000));
    expect(call1.update.paid_at).toEqual(new Date(1700003600 * 1000));
  });

  it("leaves paid_at null when Stripe hasn't recorded a paid transition (e.g. payment_failed)", async () => {
    const unpaidInvoice = { ...invoice, status: "open", status_transitions: { paid_at: null } };
    await call({ id: "evt_unpaid", type: "invoice.payment_failed", data: { object: unpaidInvoice } });
    const call1 = stripeInvoiceUpsert.mock.calls[0][0];
    expect(call1.create.paid_at).toBeNull();
  });

  it("skips rather than throws when no client_billing matches the customer", async () => {
    clientBillingFindFirst.mockResolvedValue(null);
    const res = await call({ id: "evt_4", type: "invoice.payment_failed", data: { object: invoice } });
    expect(res.statusCode).toBe(200);
    expect(stripeInvoiceUpsert).not.toHaveBeenCalled();
    // A skip is not a processing failure — the claim stands, so a redelivery of the same event
    // doesn't reprocess it either.
    expect(webhookEventDelete).not.toHaveBeenCalled();
  });
});

describe("failure", () => {
  it("500s and releases the claim when a handler branch throws, so a retry can reprocess", async () => {
    clientBillingUpdateMany.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({
      id: "evt_5",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active" } },
    });
    expect(res.statusCode).toBe(500);
    expect(webhookEventDelete).toHaveBeenCalledWith({ where: { stripe_event_id: "evt_5" } });
    err.mockRestore();
  });

  it("still 500s even if releasing the claim itself fails", async () => {
    clientBillingUpdateMany.mockRejectedValue(new Error("db down"));
    webhookEventDelete.mockRejectedValue(new Error("also db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({
      id: "evt_6",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active" } },
    });
    expect(res.statusCode).toBe(500);
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
    expect(webhookEventCreate).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("500s with a distinct config error, not a signature failure, when STRIPE_SECRET_KEY is missing", async () => {
    // Pins the fix: lib/stripe.ts's client is constructed lazily now, so a missing key used to
    // throw from inside the signature-verification try/catch and get reported as "signature
    // verification failed" — the wrong diagnosis, and one Stripe eventually stops retrying.
    delete process.env.STRIPE_SECRET_KEY;
    const req = mockReq("{}");
    const res = mockRes();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Stripe is not configured.");
    expect(constructEventMock).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
