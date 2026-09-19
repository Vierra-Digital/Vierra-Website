import type Stripe from "stripe";

/**
 * The billing portal's configuration, created from here rather than by hand in the dashboard.
 *
 * `billingPortal.sessions.create()` with no `configuration` falls back to whatever default has
 * been saved in the Stripe dashboard — and if none ever was, the call fails outright. That is
 * exactly what was happening: the account had zero portal configurations, so every "Manage
 * Billing" click ended on "Could not open the billing portal". Owning the configuration in code
 * means a fresh Stripe account (or a new environment) works on first use with no dashboard step,
 * and the feature set is reviewable here instead of in someone's browser tab.
 *
 * The enabled features mirror what this application already offers, and nothing more:
 *
 *   - customer_update — the billing details themselves: address, name, email, phone, tax id.
 *     This is the part that was asked for and the part a portal is genuinely better at than a
 *     form here would be, since Stripe validates addresses and tax ids per country.
 *   - payment_method_update — what the button has always claimed to do. Card details must never
 *     reach this application, so this stays on Stripe's pages.
 *   - invoice_history — read-only, and the client already sees a summary of it on the page.
 *
 * Deliberately NOT enabled:
 *
 *   - subscription_cancel / subscription_update. Renewal is handled in-app by
 *     /api/client/billing-subscription, which only ever sets cancel_at_period_end and never ends
 *     a subscription immediately. Turning the portal's own cancel flow on would put a second,
 *     harsher control next to it.
 */

const CONFIG_TAG = "vierra_client_portal_v1";

/** Absolute site origin, for the links Stripe requires on a live-mode configuration. */
function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://vierradev.com";
  return raw.replace(/\/$/, "");
}

function desiredFeatures(): Stripe.BillingPortal.ConfigurationCreateParams.Features {
  return {
    customer_update: {
      enabled: true,
      allowed_updates: ["address", "name", "email", "phone", "tax_id"],
    },
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
  };
}

/**
 * Resolved once per process. Concurrent callers share the same in-flight promise so a burst of
 * clicks cannot create several configurations; a failure clears it so the next request retries
 * rather than caching the error for the life of the process.
 */
let cached: Promise<string> | null = null;

async function resolveConfigurationId(stripe: Stripe): Promise<string> {
  // Reuse ours if it is already there. The list endpoint cannot filter on metadata, so this
  // matches on the tag we set when creating it.
  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const mine = existing.data.find((c) => c.metadata?.vierra_config === CONFIG_TAG);
  if (mine) return mine.id;

  const origin = siteOrigin();
  const created = await stripe.billingPortal.configurations.create({
    // Required by Stripe for a live-mode configuration; both pages exist on the site.
    business_profile: {
      privacy_policy_url: `${origin}/privacy-policy`,
      terms_of_service_url: `${origin}/terms-of-service`,
    },
    features: desiredFeatures(),
    metadata: { vierra_config: CONFIG_TAG },
  });
  return created.id;
}

/** The configuration id to pass to `billingPortal.sessions.create()`. */
export function getPortalConfigurationId(stripe: Stripe): Promise<string> {
  if (!cached) {
    cached = resolveConfigurationId(stripe).catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

/** Test seam: drop the memo so a test can observe the lookup happening again. */
export function resetPortalConfigurationCache(): void {
  cached = null;
}

export const PORTAL_CONFIG_TAG = CONFIG_TAG;
export const portalFeaturesForTest = desiredFeatures;
