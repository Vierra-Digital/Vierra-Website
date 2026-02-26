import type { NextApiRequest, NextApiResponse } from "next"
import { parse as parseCookie } from "cookie"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const { onboardingToken } = req.body ?? {}
  if (!onboardingToken) {
    return res.status(400).json({ message: "onboardingToken is required." })
  }

  const cookies = parseCookie(req.headers.cookie || "")
  if (cookies.ob_session !== onboardingToken) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const session = await prisma.onboardingSession.findUnique({
    where: { id: onboardingToken },
    include: { client: true },
  })
  if (!session || !session.client) {
    return res.status(404).json({ message: "Onboarding session not found." })
  }

  const client = session.client
  if (!client.monthlyRetainerCents || client.monthlyRetainerCents <= 0) {
    return res.status(400).json({ message: "Monthly retainer amount is missing for this client." })
  }

  let stripeCustomerId = client.stripeCustomerId

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: client.name,
      email: client.email,
      metadata: {
        vierraClientId: client.id,
        businessName: client.businessName,
      },
    })
    stripeCustomerId = customer.id
    await prisma.client.update({
      where: { id: client.id },
      data: { stripeCustomerId },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`
  const successUrl = `${baseUrl}/stripe/success`
  const cancelUrl = `${baseUrl}/onboarding/${onboardingToken}`

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: client.monthlyRetainerCents,
          recurring: { interval: "month" },
          product_data: {
            name: `${client.businessName} Monthly Retainer`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      vierraClientId: client.id,
      onboardingToken,
    },
  })

  return res.status(200).json({ url: checkoutSession.url })
}
