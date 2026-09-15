import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { resolveExplicitTargetCompanyId } from "@/lib/api/targetCompany";
import { resolveBillingClient } from "@/lib/api/billingClient";

/**
 * Changes what a client is billed going forward.
 *
 * Admin-only, and always at next renewal rather than prorated immediately: the subscription
 * item's price is swapped with proration_behavior "none", so the already-invoiced current period
 * is untouched (Stripe bills in advance) and the next invoice picks up the new amount on its own —
 * no subscription schedule or "pending amount" tracking needed for that to work.
 *
 * monthly_retainer_cents is updated immediately to match what the subscription item now says.
 * The client's own billing page (client/billing.ts) reads the live Stripe price for "current"
 * amount, not this column, so nothing client-facing is out of sync in the meantime — this is
 * purely the MRR-forecast figure catching up to what will actually be charged next cycle.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ message: "Billing is not configured." });
  }

  // Same rule as the other client-scoped billing routes: an admin who hasn't picked a client must
  // be told to, not silently land on Vierra's own company. See resolveExplicitTargetCompanyId
  // (lib/api/targetCompany.ts).
  const companyId = resolveExplicitTargetCompanyId(session, req);
  if (!companyId) return res.status(400).json({ message: "companyId is required" });

  const { newRetainerCents } = req.body ?? {};
  if (!Number.isInteger(newRetainerCents) || newRetainerCents <= 0) {
    return res.status(400).json({ message: "newRetainerCents must be a positive integer." });
  }

  try {
    const client = await resolveBillingClient({ kind: "member", companyId });
    if (!client?.client_billing?.stripe_customer_id) {
      return res.status(404).json({ message: "No billing account for this client yet." });
    }
    const clientEmail = await prisma.client.findUnique({
      where: { id: client.id },
      select: { email: true, name: true },
    });

    const { stripe } = await import("@/lib/stripe");
    const { getRetainerProductId } = await import("@/lib/stripe/retainerProduct");

    const subscriptions = await stripe.subscriptions.list({
      customer: client.client_billing.stripe_customer_id,
      status: "all",
      limit: 10,
    });
    const subscription =
      subscriptions.data.find((s) => s.status === "active" || s.status === "trialing") ?? null;
    if (!subscription) {
      return res.status(404).json({ message: "No active subscription to change." });
    }
    const item = subscription.items.data[0];
    if (!item) {
      return res.status(404).json({ message: "Subscription has no billable item." });
    }

    const oldAmountCents = item.price?.unit_amount ?? client.client_billing.monthly_retainer_cents ?? 0;
    const productId = await getRetainerProductId(stripe);
    const priceItem = (amountCents: number) => ({
      id: item.id,
      price_data: {
        currency: "usd",
        unit_amount: amountCents,
        recurring: { interval: "month" as const },
        product: productId,
      },
    });

    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [priceItem(newRetainerCents)],
      proration_behavior: "none",
    });

    try {
      await prisma.clientBilling.update({
        where: { client_id: client.id },
        data: { monthly_retainer_cents: newRetainerCents },
      });
    } catch (dbError) {
      // Stripe already committed the new price; leaving it there while the DB (and the client,
      // who hasn't been emailed yet) still says the old amount would be a silent, permanent
      // divergence. Best-effort revert Stripe back to the old price instead, so the two stay in
      // agreement even though this attempt failed, and report a clean failure rather than 200.
      console.error(
        `billing-plan: DB update failed after Stripe price change for client ${client.id} (subscription ${subscription.id}) — reverting Stripe to $${oldAmountCents / 100}`,
        dbError
      );
      try {
        await stripe.subscriptions.update(subscription.id, {
          items: [priceItem(oldAmountCents)],
          proration_behavior: "none",
        });
      } catch (revertError) {
        console.error(
          `billing-plan: also failed to revert Stripe for client ${client.id} (subscription ${subscription.id}) — Stripe now bills $${newRetainerCents / 100} while our records say $${oldAmountCents / 100}; needs manual reconciliation`,
          revertError
        );
      }
      return res.status(502).json({ message: "Could not save the plan change. Nothing was billed differently — try again." });
    }

    const periodEnd =
      (updated as unknown as { current_period_end?: number }).current_period_end ??
      updated.items.data[0]?.current_period_end ??
      null;

    if (clientEmail?.email) {
      const { sendPlanChangeEmail } = await import("@/lib/emailSender");
      try {
        await sendPlanChangeEmail(clientEmail.email, {
          oldAmountCents,
          newAmountCents: newRetainerCents,
          effectiveDate: periodEnd ? new Date(periodEnd * 1000) : new Date(),
        });
      } catch (emailError) {
        // The plan change already succeeded in Stripe and our own DB; a failed notification is
        // logged, not a reason to report the whole request as failed.
        console.error("billing-plan: plan-change email failed", emailError);
      }
    }

    return res.status(200).json({
      retainerCents: newRetainerCents,
      effectiveDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error("client/billing-plan PUT", e);
    return res.status(502).json({ message: "Could not update the plan. Try again." });
  }
}
