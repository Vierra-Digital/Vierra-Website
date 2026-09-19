import type Stripe from "stripe";

/**
 * The subscription that's currently active, else the one that's trialing — else null.
 *
 * Two status-filtered limit:1 calls rather than one "all"/limit:N list + a client-side find():
 * filtering server-side can't miss the right one regardless of how many non-matching
 * subscriptions (stale canceled ones from testing, manual dashboard changes) exist on the
 * customer — a fixed page could push the real one past it and this would answer "none" when one
 * actually exists. Shared by every route that needs "the subscription to act on" (change its
 * plan, toggle auto-renew) rather than just display one.
 */
export async function findActiveOrTrialingSubscription(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const [activeSubs, trialingSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);
  return activeSubs.data[0] ?? trialingSubs.data[0] ?? null;
}

/**
 * Same lookup, but falls back to the newest subscription of any status when there's no active or
 * trialing one — for read-only display (the client's billing overview), where showing a stale
 * subscription beats showing nothing at all. The unfiltered call is naturally "newest of any
 * status" since Stripe already orders subscriptions by created desc.
 */
export async function findDisplaySubscription(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const [activeSubs, trialingSubs, anySubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, limit: 1 }),
  ]);
  return activeSubs.data[0] ?? trialingSubs.data[0] ?? anySubs.data[0] ?? null;
}
