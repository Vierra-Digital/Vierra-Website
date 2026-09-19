import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/api/url";
import { getPortalConfigurationId } from "@/lib/stripe/billingPortal";

/**
 * A one-off link into Stripe's billing portal.
 *
 * Changing a card, adding a bank account or editing the billing details — address, company name,
 * billing email, phone, tax id — all happen on Stripe's own pages. That is deliberate: card
 * details never reach this application, so there is nothing here to mishandle, and Stripe
 * validates addresses and tax ids per country in a way a form here would not.
 *
 * Representatives only. Staff read a client's billing but do not act on their payment methods.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (session.kind !== "client") {
    return res.status(403).json({ message: "Only the client can manage their own billing." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: "Billing is not configured." });
  }

  try {
    const billing = await prisma.clientBilling.findUnique({
      where: { client_id: session.clientId },
      select: { stripe_customer_id: true },
    });
    if (!billing?.stripe_customer_id) {
      return res.status(404).json({ message: "No billing account yet." });
    }

    const { stripe } = await import("@/lib/stripe");
    // Naming the configuration explicitly, rather than letting Stripe fall back to the dashboard
    // default. The account had no default saved, so every session create failed — and even with
    // one, whether a client could edit their address depended on a setting nobody here could see.
    // lib/stripe/billingPortal owns that decision and creates the configuration on first use.
    const configuration = await getPortalConfigurationId(stripe);
    const portal = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      configuration,
      return_url: `${resolveBaseUrl(req)}/client`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error("client/billing-portal", e);
    return res.status(502).json({ message: "Could not open the billing portal. Try again." });
  }
}
