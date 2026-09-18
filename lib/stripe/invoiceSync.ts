import type Stripe from "stripe";

/**
 * The stripe_invoices upsert args for one invoice — shared by the webhook's invoice.paid/
 * invoice.payment_failed handler (pages/api/stripe/webhook.ts) and the one-off backfill
 * (scripts/backfillStripeInvoices.ts), so a future change to this shape (a new Stripe API version
 * moving a field, an added column) can't be applied to only one of the two and silently diverge
 * for the same invoice between a live sync and a rerun of the backfill.
 *
 * Resolving which client_billing row an invoice belongs to (and what to do when none matches)
 * stays with each caller — the webhook logs and skips, the backfill counts a skip — since that
 * part genuinely differs.
 */
export function buildStripeInvoiceUpsert(
  invoice: Stripe.Invoice,
  billing: { client_id: string; company_id: string },
  customerId: string
) {
  // Newer API versions moved this off the top-level invoice onto invoice.parent — see
  // Stripe.Invoice.Parent.SubscriptionDetails.
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
  const line = invoice.lines.data[0];
  // Stripe's own record of when the invoice was actually paid, not when this code happened to run
  // — a late/redelivered webhook event (Stripe explicitly retries) or a backfill rerun would
  // otherwise stamp paid_at with the processing time instead of the real payment moment.
  const paidAt = invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null;

  return {
    where: { id: invoice.id },
    create: {
      id: invoice.id,
      client_id: billing.client_id,
      company_id: billing.company_id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: invoice.status ?? "open",
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      currency: invoice.currency,
      period_start: line?.period?.start ? new Date(line.period.start * 1000) : null,
      period_end: line?.period?.end ? new Date(line.period.end * 1000) : null,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      created_at: new Date(invoice.created * 1000),
      paid_at: paidAt,
    },
    update: {
      status: invoice.status ?? "open",
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      paid_at: paidAt,
    },
  };
}
