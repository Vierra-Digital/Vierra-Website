/**
 * One-off backfill for the stripe_invoices table (see prisma/manual/20260915_stripe_invoices.sql).
 *
 * Checkout onboarding has been live since before this table existed, so Stripe already holds
 * invoices the webhook never saw. Run this once after applying the migration in Supabase:
 *
 *   npm run backfill:stripe-invoices
 *
 * Pages through every invoice in the Stripe account and upserts a row per one whose customer
 * matches a client_billing row — the same resolution and skip-on-no-match behavior the webhook's
 * invoice.paid/invoice.payment_failed handler uses, so a rerun (or the webhook catching a later
 * event for the same invoice) converges on the same data rather than duplicating it.
 */
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

async function run() {
  let seen = 0;
  let upserted = 0;
  let skipped = 0;

  for await (const invoice of stripe.invoices.list({ limit: 100 })) {
    seen += 1;

    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) {
      skipped += 1;
      continue;
    }

    const billing = await prisma.clientBilling.findFirst({
      where: { stripe_customer_id: customerId },
      select: { client_id: true, clients: { select: { company_id: true } } },
    });
    if (!billing) {
      skipped += 1;
      continue;
    }

    const subscriptionRef = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
    const line = invoice.lines.data[0];

    await prisma.stripeInvoice.upsert({
      where: { id: invoice.id },
      create: {
        id: invoice.id,
        client_id: billing.client_id,
        company_id: billing.clients.company_id,
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
        paid_at: invoice.status === "paid" ? new Date(invoice.created * 1000) : null,
      },
      update: {
        status: invoice.status ?? "open",
        amount_due_cents: invoice.amount_due,
        amount_paid_cents: invoice.amount_paid,
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      },
    });
    upserted += 1;
  }

  console.log(`Backfill complete: ${seen} invoices seen, ${upserted} upserted, ${skipped} skipped (no matching client).`);
}

run()
  .catch((error) => {
    console.error("backfillStripeInvoices failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
