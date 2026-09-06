import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

/**
 * Billing as Stripe has it.
 *
 * Nothing here is mirrored into our own tables beyond the customer id: an invoice's status, the
 * card on file and whether the subscription renews all change in Stripe without telling us, so a
 * copy would be wrong more often than not. client_billing holds the pointer; this reads through it.
 *
 * A representative always reads their own client. A Vierra staff member names the client company
 * they are looking at, the same as every other client-scoped route.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (session.kind === "unaffiliated") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const companyId =
    session.kind === "client" ? session.companyId : resolveTargetCompanyId(session, req);
  if (!companyId) return res.status(400).json({ message: "companyId is required" });

  try {
    const client =
      session.kind === "client"
        ? await prisma.client.findFirst({
            where: { id: session.clientId },
            select: { id: true, name: true, client_billing: true },
          })
        : await prisma.client.findFirst({
            where: { company_id: companyId },
            select: { id: true, name: true, client_billing: true },
          });

    const billing = client?.client_billing ?? null;
    const customerId = billing?.stripe_customer_id ?? null;

    // Reported rather than thrown: a workspace with no Stripe customer yet is an ordinary state,
    // and the page says so instead of showing an error.
    if (!customerId || !process.env.STRIPE_SECRET_KEY) {
      return res.status(200).json({
        connected: false,
        retainerCents: billing?.monthly_retainer_cents ?? null,
        paymentMethods: [],
        subscription: null,
        invoices: [],
        payments: [],
      });
    }

    const { stripe } = await import("@/lib/stripe");
    /**
     * Paged, not capped at one response.
     *
     * A test customer has a handful of rows and a single list() looks complete; a customer two
     * years into a monthly retainer has more than a page, and the tail would simply never be
     * shown. autoPagingToArray follows the cursor, with a ceiling so one very old account cannot
     * hold the request open indefinitely.
     */
    const [customer, methods, subscriptions, invoices, charges] = await Promise.all([
      stripe.customers.retrieve(customerId),
      stripe.paymentMethods.list({ customer: customerId, limit: 20 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }),
      stripe.invoices
        .list({ customer: customerId, limit: 100 })
        .autoPagingToArray({ limit: 500 }),
      stripe.charges.list({ customer: customerId, limit: 100 }).autoPagingToArray({ limit: 500 }),
    ]);

    const defaultMethodId =
      !("deleted" in customer && customer.deleted) &&
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : null;

    // The newest subscription that is still live, else the newest of any status.
    const subscription =
      subscriptions.data.find((s) => s.status === "active" || s.status === "trialing") ??
      subscriptions.data[0] ??
      null;
    // Stripe moved the period boundary onto the subscription item; older versions keep it on the
    // subscription itself, so both are read rather than assuming which one this account returns.
    const periodEnd =
      (subscription as unknown as { current_period_end?: number })?.current_period_end ??
      subscription?.items?.data?.[0]?.current_period_end ??
      null;

    return res.status(200).json({
      connected: true,
      clientName: client?.name ?? null,
      retainerCents: billing?.monthly_retainer_cents ?? null,
      paymentMethods: methods.data.map((method) => ({
        id: method.id,
        type: method.type,
        brand: method.card?.brand ?? null,
        last4: method.card?.last4 ?? method.us_bank_account?.last4 ?? null,
        bankName: method.us_bank_account?.bank_name ?? null,
        expMonth: method.card?.exp_month ?? null,
        expYear: method.card?.exp_year ?? null,
        isDefault: method.id === defaultMethodId,
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            amountCents: subscription.items.data[0]?.price?.unit_amount ?? null,
            interval: subscription.items.data[0]?.price?.recurring?.interval ?? null,
          }
        : null,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        // A draft has no number and no PDF until it is finalised, so the UI is told plainly
        // rather than rendering an empty cell where an identifier should be.
        number: invoice.number,
        status: invoice.status,
        totalCents: invoice.total,
        amountPaidCents: invoice.amount_paid,
        amountDueCents: invoice.amount_due,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000).toISOString(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        pdfUrl: invoice.invoice_pdf ?? null,
        hostedUrl: invoice.hosted_invoice_url ?? null,
        description: invoice.lines.data[0]?.description ?? null,
      })),
      payments: charges.map((charge) => ({
        id: charge.id,
        status: charge.status,
        amountCents: charge.amount,
        refundedCents: charge.amount_refunded,
        currency: charge.currency,
        created: new Date(charge.created * 1000).toISOString(),
        description: charge.description,
        receiptUrl: charge.receipt_url ?? null,
        failureMessage: charge.failure_message ?? null,
        brand: charge.payment_method_details?.card?.brand ?? null,
        last4: charge.payment_method_details?.card?.last4 ?? null,
      })),
    });
  } catch (e) {
    console.error("client/billing GET", e);
    return res.status(502).json({ message: "Could not reach Stripe." });
  }
}
