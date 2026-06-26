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

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
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

  return res.status(200).json({ received: true })
}
