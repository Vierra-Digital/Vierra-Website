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
      client: {
        select: {
          stripeCustomerId: true,
          stripeConnected: true,
          stripeSubscriptionId: true,
          stripeSubscriptionStatus: true,
          stripeCardBrand: true,
          stripeCardLast4: true,
          stripeConnectedAt: true,
        },
      },
    },
  })

  if (!session?.client?.stripeCustomerId) {
    return res.status(200).json({ connected: false })
  }

  if (session.client.stripeConnected) {
    return res.status(200).json({
      connected: true,
      subscriptionId: session.client.stripeSubscriptionId,
      subscriptionStatus: session.client.stripeSubscriptionStatus,
      cardBrand: session.client.stripeCardBrand,
      cardLast4: session.client.stripeCardLast4,
      connectedAt: session.client.stripeConnectedAt,
    })
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: session.client.stripeCustomerId,
    type: "card",
    limit: 1,
  })

  if (paymentMethods.data.length > 0) {
    const pm = paymentMethods.data[0]
    await prisma.client.updateMany({
      where: { stripeCustomerId: session.client.stripeCustomerId },
      data: {
        stripeConnected: true,
        stripePaymentMethodId: pm.id,
        stripeCardBrand: pm.card?.brand ?? null,
        stripeCardLast4: pm.card?.last4 ?? null,
        stripeConnectedAt: new Date(),
      },
    })

    return res.status(200).json({
      connected: true,
      subscriptionId: session.client.stripeSubscriptionId,
      subscriptionStatus: session.client.stripeSubscriptionStatus,
      cardBrand: pm.card?.brand,
      cardLast4: pm.card?.last4,
    })
  }

  return res.status(200).json({ connected: false })
}
