import type Stripe from "stripe";

/**
 * The one Stripe product every retainer subscription bills against.
 *
 * Checkout used to pass `price_data.product_data.name`, which makes Stripe create a product on the
 * fly. Two consequences, both bad:
 *
 *  - A separate product per client, named "<Business> Monthly Retainer", so the invoice line read
 *    "1 × Acme Co Monthly Retainer (at $1,000.00 / month)" — quoting the client's own name back at
 *    them on the invoice they are paying.
 *  - Those products are flagged as created by Stripe automatically and are **immutable**. Renaming
 *    them fails with "The product was created by Stripe automatically and cannot be updated", so
 *    the existing ones cannot be corrected at all.
 *
 * Creating the product ourselves and passing its id fixes both: one product for the service, and
 * one that can actually be renamed later.
 */

export const RETAINER_PRODUCT_NAME = "Vierra Lead Generation";

const TAG = "vierra_retainer";

let cached: Promise<string> | null = null;

async function resolve(stripe: Stripe): Promise<string> {
  // The list cannot filter on metadata, so this matches the tag we set when creating it.
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const mine = existing.data.find((p) => p.metadata?.vierra_product === TAG);
  if (mine) return mine.id;

  const created = await stripe.products.create({
    name: RETAINER_PRODUCT_NAME,
    metadata: { vierra_product: TAG },
  });
  return created.id;
}

/** The product id to bill a retainer against; created on first use. */
export function getRetainerProductId(stripe: Stripe): Promise<string> {
  if (!cached) {
    cached = resolve(stripe).catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

/** Test seam: drop the memo so a test can observe the lookup happening again. */
export function resetRetainerProductCache(): void {
  cached = null;
}

export const RETAINER_PRODUCT_TAG = TAG;
