import { describe, expect, it } from "vitest";
import {
  billingRows,
  hasBillingDetails,
  type BillingDetails,
} from "@/lib/billing/billingDetails";

/**
 * The Billing Information card. Stripe returns each part of an address as its own nullable field,
 * so the failure this guards is a card full of blank rows and a value column that stops lining up
 * with its labels — the columns were the complaint that prompted the card in the first place.
 *
 * Verified once against a real Stripe test customer carrying a full address before these offline
 * cases were written.
 */

const full: BillingDetails = {
  name: "Iron & Water Co.",
  email: "billing@ironandwater.test",
  phone: "+1 617 555 0142",
  address: {
    line1: "3 Ashland Street",
    line2: "Suite 200",
    city: "Medford",
    state: "MA",
    postalCode: "02155",
    country: "US",
  },
};

const empty: BillingDetails = { name: null, email: null, phone: null, address: null };

describe("hasBillingDetails", () => {
  it("is false for a customer Stripe holds nothing for", () => {
    expect(hasBillingDetails(empty)).toBe(false);
    expect(hasBillingDetails(null)).toBe(false);
    expect(hasBillingDetails(undefined)).toBe(false);
  });

  it("is true as soon as any single field is set", () => {
    for (const key of ["name", "email", "phone"] as const) {
      expect(hasBillingDetails({ ...empty, [key]: "x" }), key).toBe(true);
    }
    expect(hasBillingDetails({ ...empty, address: full.address })).toBe(true);
  });
});

describe("billingRows", () => {
  it("prints the full set in invoice order", () => {
    expect(billingRows(full)).toEqual([
      ["Billed To", "Iron & Water Co."],
      ["Email", "billing@ironandwater.test"],
      ["Phone", "+1 617 555 0142"],
      ["Billing Address", "3 Ashland Street"],
      ["", "Suite 200"],
      ["", "Medford, MA, 02155"],
      ["Country", "US"],
    ]);
  });

  it("emits no row for a field Stripe has no value for", () => {
    // The whole point: a partially filled customer must not produce blank rows, which is what
    // makes the label and value columns stop lining up.
    const rows = billingRows({
      name: "Acme",
      email: null,
      phone: null,
      address: { line1: "1 Main St", line2: null, city: null, state: null, postalCode: null, country: "US" },
    });
    expect(rows).toEqual([
      ["Billed To", "Acme"],
      ["Billing Address", "1 Main St"],
      ["Country", "US"],
    ]);
    expect(rows.every(([, value]) => value.length > 0)).toBe(true);
  });

  it("returns nothing at all when there is nothing to print", () => {
    expect(billingRows(empty)).toEqual([]);
  });

  it("joins whichever locality parts exist, without stray separators", () => {
    const locality = (address: Partial<BillingDetails["address"]>) =>
      billingRows({
        ...empty,
        address: { line1: "1 Main St", line2: null, city: null, state: null, postalCode: null, country: null, ...address },
      } as BillingDetails).find(([label], i) => label === "" && i > 0)?.[1];

    expect(locality({ city: "Medford", state: "MA", postalCode: "02155" })).toBe("Medford, MA, 02155");
    expect(locality({ city: "Medford", postalCode: "02155" })).toBe("Medford, 02155");
    expect(locality({ city: "Medford" })).toBe("Medford");
    expect(locality({ postalCode: "02155" })).toBe("02155");
    // Nothing to join means no continuation row rather than an empty one.
    expect(locality({})).toBeUndefined();
  });

  it("keeps continuation rows label-less so the address reads as one block", () => {
    // Repeating "Address" against line2 and the locality would read as three separate addresses.
    const rows = billingRows(full);
    const addressRows = rows.slice(3, 6);
    expect(addressRows.map(([label]) => label)).toEqual(["Billing Address", "", ""]);
  });

  it("survives an address whose only content is a country", () => {
    const rows = billingRows({
      ...empty,
      address: { line1: null, line2: null, city: null, state: null, postalCode: null, country: "GB" },
    });
    expect(rows).toEqual([["Country", "GB"]]);
  });
});

describe("an address Stripe cleared", () => {
  /**
   * Clearing an address in Stripe leaves the object in place with every field an empty string
   * rather than removing it. Treated as present, the card rendered neither address rows nor the
   * "not set" line — just a gap.
   */
  const blank = {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  };

  it("does not count as having details", () => {
    expect(hasBillingDetails({ name: null, email: null, phone: null, address: blank })).toBe(false);
  });

  it("still counts when another field is set", () => {
    expect(hasBillingDetails({ name: "Acme", email: null, phone: null, address: blank })).toBe(true);
  });

  it("counts as soon as one address field has content", () => {
    expect(
      hasBillingDetails({ name: null, email: null, phone: null, address: { ...blank, city: "Medford" } })
    ).toBe(true);
  });

  it("treats whitespace as empty", () => {
    expect(
      hasBillingDetails({ name: null, email: null, phone: null, address: { ...blank, line1: "   " } })
    ).toBe(false);
  });

  it("produces no rows for it", () => {
    expect(billingRows({ name: null, email: null, phone: null, address: blank })).toEqual([]);
  });
});
