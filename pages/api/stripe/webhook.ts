import type { NextApiRequest, NextApiResponse } from "next"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import type Stripe from "stripe"

export const config = {
  api: { bodyParser: false },
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

async function savePaymentMethod(customerId: string) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  })

  const pm = paymentMethods.data[0]
  if (!pm) return

  await prisma.clientBilling.updateMany({
    where: { stripe_customer_id: customerId },
    data: {
      stripe_connected: true,
      stripe_payment_method_id: pm.id,
      stripe_card_brand: pm.card?.brand ?? null,
      stripe_card_last4: pm.card?.last4 ?? null,
      stripe_connected_at: new Date(),
    },
  })
}

async function saveSubscriptionFromCheckout(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id

  if (!customerId || !subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  })

  const defaultPaymentMethod = subscription.default_payment_method
  const pm = defaultPaymentMethod && typeof defaultPaymentMethod !== "string" ? defaultPaymentMethod : null

  await prisma.clientBilling.updateMany({
    where: { stripe_customer_id: customerId },
    data: {
      stripe_connected: true,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_payment_method_id: pm?.id ?? null,
      stripe_card_brand: pm?.card?.brand ?? null,
      stripe_card_last4: pm?.card?.last4 ?? null,
      stripe_connected_at: new Date(),
    },
  })
}

async function saveSubscriptionStatus(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

  await prisma.clientBilling.updateMany({
    where: { stripe_customer_id: customerId },
    data: {
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      stripe_connected: subscription.status !== "canceled" && subscription.status !== "incomplete_expired",
    },
  })
}

/**
 * Upserts one row into stripe_invoices for invoice.paid / invoice.payment_failed.
 *
 * A Stripe customer with no matching client_billing row (a stray or test customer, or one created
 * outside the onboarding flow) is skipped rather than thrown on — an unhandled error here would
 * 500 the webhook and Stripe would retry the same unresolvable event forever.
 */
async function saveInvoice(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const billing = await prisma.clientBilling.findFirst({
    where: { stripe_customer_id: customerId },
    select: { client_id: true, clients: { select: { company_id: true } } },
  })
  if (!billing) {
    console.warn(`stripe webhook: invoice ${invoice.id} has no matching client_billing for customer ${customerId}`)
    return
  }

  // Newer API versions moved this off the top-level invoice onto invoice.parent — see
  // Stripe.Invoice.Parent.SubscriptionDetails.
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null
  const line = invoice.lines.data[0]

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
      paid_at: invoice.status === "paid" ? new Date() : null,
    },
    update: {
      status: invoice.status ?? "open",
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      paid_at: invoice.status === "paid" ? new Date() : null,
    },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).end()
  }

  const sig = req.headers["stripe-signature"]
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ message: "Missing signature or webhook secret." })
  }

  let event: Stripe.Event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err)
    return res.status(400).json({ message: "Webhook signature verification failed." })
  }

  // Stripe redelivers an event that wasn't acknowledged in time, or on request (stripe events
  // resend), and can even deliver a genuine duplicate concurrently rather than serially — a
  // find-then-create here would let both requests pass the find before either had inserted,
  // reprocessing the event twice and throwing an uncaught unique-constraint error from whichever
  // create() lost the race. Claiming the row with the insert itself (matching the same pattern
  // pages/api/campaigns/webhooks/smartlead.ts uses) makes the claim atomic: only one concurrent
  // request can win it, and the unique-constraint violation on the insert IS the duplicate signal
  // for the other. Unlike Smartlead's webhook, a processing failure below must still let Stripe
  // retry, so the claim is released (the row deleted) if the handler throws.
  try {
    await prisma.stripeWebhookEvent.create({
      data: { stripe_event_id: event.id, event_type: event.type },
    })
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return res.status(200).json({ received: true, duplicate: true })
    }
    console.error(`Stripe webhook: failed to record event ${event.id}:`, err)
    return res.status(500).json({ message: "Webhook handler failed." })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === "setup" && session.customer) {
        const customerId = typeof session.customer === "string" ? session.customer : session.customer.id
        await savePaymentMethod(customerId)
      }
      if (session.mode === "subscription") {
        await saveSubscriptionFromCheckout(session)
      }
    }

    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object as Stripe.SetupIntent
      if (setupIntent.customer) {
        const customerId = typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer.id
        await savePaymentMethod(customerId)
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await saveSubscriptionStatus(event.data.object as Stripe.Subscription)
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      await saveInvoice(event.data.object as Stripe.Invoice)
    }
  } catch (err) {
    console.error(`Stripe webhook handler failed for ${event.type} (${event.id}):`, err)
    // Release the claim so a Stripe retry (triggered by this 500) can reprocess rather than being
    // silently swallowed as an already-seen duplicate.
    await prisma.stripeWebhookEvent.delete({ where: { stripe_event_id: event.id } }).catch(() => {})
    // 500 so Stripe retries the delivery — this is a processing failure, not a signal that the
    // event was malformed or already handled.
    return res.status(500).json({ message: "Webhook handler failed." })
  }

  return res.status(200).json({ received: true })
}
