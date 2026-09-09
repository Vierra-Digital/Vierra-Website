/**
 * The headline figures above the billing tables, derived from what Stripe reports.
 *
 * Pulled out of the component because each one is a judgement about which Stripe rows count, and
 * getting it wrong shows the client a number about their own money that disagrees with the tables
 * printed directly underneath it.
 */

export type SummaryInvoice = {
  status: string | null;
  amountPaidCents: number;
  amountDueCents: number;
};

export type SummaryPayment = {
  status: string;
  refundedCents: number;
};

export type BillingSummary = {
  /** Net of refunds. */
  paidCents: number;
  /** Refunded across all charges, so the paid figure can be explained. */
  refundedCents: number;
  outstandingCents: number;
  openInvoiceCount: number;
};

/**
 * Invoice statuses that represent money someone still owes.
 *
 * A draft carries no amount anyone owes yet and a void invoice is not owed either, so counting
 * either would overstate the balance. `uncollectible` is still owed — Stripe's word for "we have
 * given up chasing it", not "it was forgiven".
 */
const OWED_STATUSES = new Set(["open", "uncollectible"]);

export function summariseBilling(
  invoices: readonly SummaryInvoice[],
  payments: readonly SummaryPayment[]
): BillingSummary {
  const invoicedPaid = invoices.reduce((sum, i) => sum + (i.amountPaidCents || 0), 0);

  /**
   * Refunds come off the total.
   *
   * Stripe records a refund against the charge, never against the invoice — a fully refunded
   * invoice still reports amount_paid equal to its total. Reading only the invoices therefore
   * counted refunded money as paid, and "Paid To Date" sat above a Payments table that plainly
   * showed the refund.
   */
  const refundedCents = payments.reduce((sum, p) => sum + (p.refundedCents || 0), 0);

  const outstandingCents = invoices
    .filter((i) => OWED_STATUSES.has(i.status ?? ""))
    .reduce((sum, i) => sum + (i.amountDueCents || 0), 0);

  return {
    // Floored: a refund against a charge that was never invoiced could otherwise drive the
    // headline negative, which reads as a bug rather than as a credit.
    paidCents: Math.max(0, invoicedPaid - refundedCents),
    refundedCents,
    outstandingCents,
    openInvoiceCount: invoices.filter((i) => i.status === "open").length,
  };
}
