import Stripe from "stripe"

/**
 * Constructed lazily, on first property access, so merely importing this module has no side
 * effects — same reasoning as lib/prisma.ts's Proxy. Billing is optional (see .env.example), so
 * any module that imports this transitively (directly or via a shared helper) would otherwise
 * require STRIPE_SECRET_KEY just to be loaded, including by a unit test that never touches Stripe.
 */
let client: Stripe | undefined

function getClient(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  client = new Stripe(key)
  return client
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getClient() as unknown as Record<string | symbol, unknown>
    const value = instance[prop]
    return typeof value === "function" ? value.bind(instance) : value
  },
  has(_target, prop) {
    return prop in (getClient() as unknown as object)
  },
})
