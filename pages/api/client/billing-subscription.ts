import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/**
 * Turns automatic renewal on or off.
 *
 * Done here rather than only through Stripe's portal because it is the one billing control a
 * client reaches for often enough that a round trip to another site is a real cost. Everything
 * that touches card details still goes to the portal.
 *
 * Nothing is deleted: cancel_at_period_end leaves the subscription running to the end of the
 * period already paid for, and resuming clears the flag. There is no path here that ends a
 * subscription immediately.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireSession(req, res);
  if (!session) return;
  if (session.kind !== "client") {
    return res.status(403).json({ message: "Only the client can change their own renewal." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: "Billing is not configured." });
  }

  const { autoRenew } = req.body ?? {};
  if (typeof autoRenew !== "boolean") {
    return res.status(400).json({ message: "autoRenew must be true or false" });
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
    // Read the live subscription rather than trusting an id sent by the browser, which would let
    // a caller name any subscription in the account.
    const subscriptions = await stripe.subscriptions.list({
      customer: billing.stripe_customer_id,
      status: "all",
      limit: 10,
    });
    const subscription =
      subscriptions.data.find((s) => s.status === "active" || s.status === "trialing") ?? null;
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription to change." });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: !autoRenew,
    });

    await prisma.clientBilling.update({
      where: { client_id: session.clientId },
      data: { stripe_subscription_id: updated.id, stripe_subscription_status: updated.status },
    });

    return res.status(200).json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      status: updated.status,
    });
  } catch (e) {
    console.error("client/billing-subscription", e);
    return res.status(502).json({ message: "Could not update renewal. Try again." });
  }
}
