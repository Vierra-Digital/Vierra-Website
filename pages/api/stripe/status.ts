import type { NextApiRequest, NextApiResponse } from "next"
import { parse as parseCookie } from "cookie"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const onboardingToken = typeof req.query.session === "string" ? req.query.session : ""
  if (!onboardingToken) {
    return res.status(400).json({ connected: false })
  }

  const cookies = parseCookie(req.headers.cookie || "")
  if (cookies.ob_session !== onboardingToken) {
    return res.status(403).json({ connected: false })
  }

  const session = await prisma.onboardingSession.findUnique({
    where: { id: onboardingToken },
    include: {
      clients: {
        select: {
          id: true,
          client_billing: {
            select: {
              stripe_customer_id: true,
              stripe_connected: true,
              stripe_subscription_id: true,
              stripe_subscription_status: true,
              stripe_card_brand: true,
              stripe_card_last4: true,
              stripe_connected_at: true,
            },
          },
        },
      },
    },
  })

  if (!session?.clients?.client_billing?.stripe_customer_id) {
    return res.status(200).json({ connected: false })
  }

  const billing = session.clients.client_billing

  if (billing.stripe_connected) {
    return res.status(200).json({
      connected: true,
      subscriptionId: billing.stripe_subscription_id,
      subscriptionStatus: billing.stripe_subscription_status,
      cardBrand: billing.stripe_card_brand,
      cardLast4: billing.stripe_card_last4,
      connectedAt: billing.stripe_connected_at,
    })
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: billing.stripe_customer_id!,
    type: "card",
    limit: 1,
  })

  if (paymentMethods.data.length > 0) {
    const pm = paymentMethods.data[0]
    await prisma.clientBilling.update({
      where: { client_id: session.clients.id },
      data: {
        stripe_connected: true,
        stripe_payment_method_id: pm.id,
        stripe_card_brand: pm.card?.brand ?? null,
        stripe_card_last4: pm.card?.last4 ?? null,
        stripe_connected_at: new Date(),
      },
    })

    return res.status(200).json({
      connected: true,
      subscriptionId: billing.stripe_subscription_id,
      subscriptionStatus: billing.stripe_subscription_status,
      cardBrand: pm.card?.brand,
      cardLast4: pm.card?.last4,
    })
  }

  return res.status(200).json({ connected: false })
}
