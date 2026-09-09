import { describe, expect, it } from "vitest";
import { summariseBilling, type SummaryInvoice, type SummaryPayment } from "@/lib/billing/summary";

/**
 * The four figures printed above the billing tables. Each is a claim about the client's own money
 * that sits directly above the rows it is derived from, so a wrong one is both visible and
 * embarrassing.
 */

const inv = (over: Partial<SummaryInvoice> = {}): SummaryInvoice => ({
  status: "paid",
  amountPaidCents: 0,
  amountDueCents: 0,
  ...over,
});

const pay = (over: Partial<SummaryPayment> = {}): SummaryPayment => ({
  status: "succeeded",
  refundedCents: 0,
  ...over,
});

describe("paid to date", () => {
  it("adds up what has actually been paid against invoices", () => {
    const s = summariseBilling(
      [inv({ amountPaidCents: 250000 }), inv({ amountPaidCents: 120000 })],
      []
    );
    expect(s.paidCents).toBe(370000);
  });

  it("subtracts refunds, which Stripe never takes off the invoice", () => {
    // The bug this fixes: a refund is recorded against the charge, so a fully refunded invoice
    // still reports amount_paid equal to its total. "Paid To Date" counted that money as paid
    // while the Payments table right below it showed the refund.
    const s = summariseBilling(
      [inv({ amountPaidCents: 250000 })],
      [pay({ refundedCents: 250000 })]
    );
    expect(s.paidCents).toBe(0);
    expect(s.refundedCents).toBe(250000);
  });

  it("handles a partial refund", () => {
    const s = summariseBilling([inv({ amountPaidCents: 250000 })], [pay({ refundedCents: 50000 })]);
    expect(s.paidCents).toBe(200000);
    expect(s.refundedCents).toBe(50000);
  });

  it("never goes negative", () => {
    // A refund against a charge that was never invoiced would otherwise drive the headline below
    // zero, which reads as a rendering fault rather than as a credit.
    const s = summariseBilling([], [pay({ refundedCents: 90000 })]);
    expect(s.paidCents).toBe(0);
    expect(s.refundedCents).toBe(90000);
  });

  it("ignores a failed charge, which moved no money", () => {
    const s = summariseBilling(
      [inv({ amountPaidCents: 250000 })],
      [pay({ status: "failed", refundedCents: 0 })]
    );
    expect(s.paidCents).toBe(250000);
  });
});

describe("outstanding", () => {
  it("counts open invoices", () => {
    const s = summariseBilling(
      [inv({ status: "open", amountDueCents: 250000 }), inv({ status: "open", amountDueCents: 120000 })],
      []
    );
    expect(s.outstandingCents).toBe(370000);
    expect(s.openInvoiceCount).toBe(2);
  });

  it("counts uncollectible, which is given up on but still owed", () => {
    const s = summariseBilling([inv({ status: "uncollectible", amountDueCents: 250000 })], []);
    expect(s.outstandingCents).toBe(250000);
    // Not "to pay" in the sense the hint means, so it is not in the open count.
    expect(s.openInvoiceCount).toBe(0);
  });

  it("excludes drafts and voids, which nobody owes", () => {
    const s = summariseBilling(
      [
        inv({ status: "draft", amountDueCents: 120000 }),
        inv({ status: "void", amountDueCents: 99000 }),
        inv({ status: "paid", amountDueCents: 0 }),
      ],
      []
    );
    expect(s.outstandingCents).toBe(0);
    expect(s.openInvoiceCount).toBe(0);
  });

  it("treats a null status as not owed rather than throwing", () => {
    const s = summariseBilling([inv({ status: null, amountDueCents: 5000 })], []);
    expect(s.outstandingCents).toBe(0);
  });
});

describe("empty and malformed input", () => {
  it("reports zeroes for a customer with no history", () => {
    expect(summariseBilling([], [])).toEqual({
      paidCents: 0,
      refundedCents: 0,
      outstandingCents: 0,
      openInvoiceCount: 0,
    });
  });

  it("survives a row missing its amounts", () => {
    const s = summariseBilling(
      [{ status: "open" } as SummaryInvoice],
      [{ status: "succeeded" } as SummaryPayment]
    );
    expect(s).toEqual({ paidCents: 0, refundedCents: 0, outstandingCents: 0, openInvoiceCount: 1 });
  });
});

describe("the whole picture reconciles", () => {
  it("matches a realistic account: one paid, one refunded, one open, one draft", () => {
    const s = summariseBilling(
      [
        inv({ status: "paid", amountPaidCents: 250000 }),
        inv({ status: "paid", amountPaidCents: 250000 }),
        inv({ status: "open", amountDueCents: 250000 }),
        inv({ status: "draft", amountDueCents: 120000 }),
      ],
      [pay({ refundedCents: 250000 }), pay(), pay({ status: "failed" })]
    );
    expect(s).toEqual({
      paidCents: 250000,
      refundedCents: 250000,
      outstandingCents: 250000,
      openInvoiceCount: 1,
    });
  });
});
