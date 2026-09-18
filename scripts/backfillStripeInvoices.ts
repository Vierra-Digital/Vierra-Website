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
import { buildStripeInvoiceUpsert } from "@/lib/stripe/invoiceSync";

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

    await prisma.stripeInvoice.upsert(
      buildStripeInvoiceUpsert(invoice, { client_id: billing.client_id, company_id: billing.clients.company_id }, customerId)
    );
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
