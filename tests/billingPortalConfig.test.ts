import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  getPortalConfigurationId,
  PORTAL_CONFIG_TAG,
  resetPortalConfigurationCache,
} from "@/lib/stripe/billingPortal";

/**
 * The billing portal is where a client edits their card AND their billing details — address,
 * company name, billing email, phone, tax id.
 *
 * It was reaching Stripe with no `configuration`, which means Stripe falls back to whatever
 * default is saved in the dashboard. The account had none saved, so every session create failed
 * and "Manage Billing" only ever produced an error. Even once a default existed, whether a client
 * could edit their address depended on a dashboard setting invisible from here.
 *
 * These cases pin the two things that made it break: a configuration is always named, and it
 * allows address editing. Verified once against Stripe's real test API before being written as
 * the offline version here.
 */

type Cfg = { id: string; active: boolean; metadata?: Record<string, string> };

function fakeStripe(existing: Cfg[] = []) {
  const created: unknown[] = [];
  const list = vi.fn(async () => ({ data: existing }));
  const create = vi.fn(async (params: unknown) => {
    created.push(params);
    const cfg = {
      id: `bpc_new${created.length}`,
      active: true,
      metadata: (params as { metadata?: Record<string, string> }).metadata,
    };
    existing.push(cfg);
    return cfg;
  });
  const stripe = { billingPortal: { configurations: { list, create } } } as unknown as Stripe;
  return { stripe, list, create, created };
}

const tagged = (id: string): Cfg => ({
  id,
  active: true,
  metadata: { vierra_config: PORTAL_CONFIG_TAG },
});

beforeEach(() => {
  resetPortalConfigurationCache();
});

describe("getPortalConfigurationId", () => {
  it("creates a configuration when the account has none", async () => {
    // The state the account was actually in: zero portal configurations.
    const { stripe, create } = fakeStripe([]);
    expect(await getPortalConfigurationId(stripe)).toBe("bpc_new1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("lets the client edit the billing address, which is the point of the fix", async () => {
    const { stripe, created } = fakeStripe([]);
    await getPortalConfigurationId(stripe);

    const params = created[0] as Stripe.BillingPortal.ConfigurationCreateParams;
    const update = params.features.customer_update;
    expect(update?.enabled).toBe(true);
    for (const field of ["address", "name", "email", "phone", "tax_id"]) {
      expect(update?.allowed_updates, field).toContain(field);
    }
  });

  it("keeps the card on Stripe's pages and the invoice list readable", async () => {
    const { stripe, created } = fakeStripe([]);
    await getPortalConfigurationId(stripe);
    const params = created[0] as Stripe.BillingPortal.ConfigurationCreateParams;
    expect(params.features.payment_method_update?.enabled).toBe(true);
    expect(params.features.invoice_history?.enabled).toBe(true);
  });

  it("does not offer its own cancel flow, because renewal is handled in-app", async () => {
    // /api/client/billing-subscription only ever sets cancel_at_period_end and never ends a
    // subscription immediately. The portal's cancel flow would sit next to that as a harsher
    // second control.
    const { stripe, created } = fakeStripe([]);
    await getPortalConfigurationId(stripe);
    const params = created[0] as Stripe.BillingPortal.ConfigurationCreateParams;
    expect(params.features.subscription_cancel).toBeUndefined();
    expect(params.features.subscription_update).toBeUndefined();
  });

  it("carries the policy links Stripe requires of a live-mode configuration", async () => {
    const { stripe, created } = fakeStripe([]);
    await getPortalConfigurationId(stripe);
    const params = created[0] as Stripe.BillingPortal.ConfigurationCreateParams;
    expect(params.business_profile?.privacy_policy_url).toMatch(/^https?:\/\/.+\/privacy-policy$/);
    expect(params.business_profile?.terms_of_service_url).toMatch(
      /^https?:\/\/.+\/terms-of-service$/
    );
  });

  it("reuses one we already made instead of creating another", async () => {
    // configurations.list cannot filter on metadata, so reuse depends on the tag being matched
    // here. Without it every cold start would add another configuration to the account.
    const { stripe, create } = fakeStripe([tagged("bpc_existing")]);
    expect(await getPortalConfigurationId(stripe)).toBe("bpc_existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("ignores a configuration that is not ours", async () => {
    const { stripe, create } = fakeStripe([
      { id: "bpc_someone_else", active: true },
      { id: "bpc_other_tag", active: true, metadata: { vierra_config: "something_else" } },
    ]);
    expect(await getPortalConfigurationId(stripe)).toBe("bpc_new1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("asks Stripe once, then serves the memo", async () => {
    const { stripe, list } = fakeStripe([tagged("bpc_existing")]);
    await getPortalConfigurationId(stripe);
    await getPortalConfigurationId(stripe);
    await getPortalConfigurationId(stripe);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight lookup between concurrent callers", async () => {
    // A burst of clicks must not race into several created configurations.
    const { stripe, list, create } = fakeStripe([]);
    const [a, b, c] = await Promise.all([
      getPortalConfigurationId(stripe),
      getPortalConfigurationId(stripe),
      getPortalConfigurationId(stripe),
    ]);
    expect([b, c]).toEqual([a, a]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure rather than caching the error forever", async () => {
    // A cached rejection would leave billing broken for the life of the process over one blip.
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error("stripe unreachable"))
      .mockResolvedValue({ data: [tagged("bpc_existing")] });
    const stripe = {
      billingPortal: { configurations: { list, create: vi.fn() } },
    } as unknown as Stripe;

    await expect(getPortalConfigurationId(stripe)).rejects.toThrow("stripe unreachable");
    await expect(getPortalConfigurationId(stripe)).resolves.toBe("bpc_existing");
  });
});
