import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  SUBDIVISIONS,
  formatPhone,
  isBillingFormValid,
  validateBillingForm,
  type BillingForm,
} from "@/lib/billing/billingForm";

/**
 * The Edit Billing Information dialog keeps Save disabled until the form is acceptable, so these
 * rules decide whether the button is usable at all. They are also what stops a submit failing on
 * something the form already knew about — the endpoint validates too, but a round trip is a poor
 * way to learn that a ZIP code is four digits.
 */

const empty: BillingForm = {
  name: "", email: "", phone: "", line1: "", line2: "",
  city: "", state: "", postalCode: "", country: "",
};

const full: BillingForm = {
  name: "Iron & Water Co.",
  email: "billing@ironandwater.test",
  phone: "+1 617 555 0142",
  line1: "3 Ashland Street",
  line2: "Suite 200",
  city: "Medford",
  state: "MA",
  postalCode: "02155",
  country: "US",
};

describe("an empty form", () => {
  it("is valid — every field is optional and clearing one is a real edit", () => {
    expect(validateBillingForm(empty)).toEqual({});
    expect(isBillingFormValid(empty)).toBe(true);
  });
});

describe("a complete form", () => {
  it("is valid", () => {
    expect(validateBillingForm(full)).toEqual({});
  });
});

describe("email", () => {
  it("accepts ordinary addresses, including the awkward ones", () => {
    for (const email of [
      "a@b.co",
      "billing+stripe@acme.co.uk",
      "first.last@sub.domain.io",
      "user_name@example-host.com",
    ]) {
      expect(validateBillingForm({ ...empty, email }).email, email).toBeUndefined();
    }
  });

  it("rejects what is plainly not an address", () => {
    for (const email of ["acme.co", "a@b", "a b@c.co", "@b.co", "a@.co", "a@b."]) {
      expect(validateBillingForm({ ...empty, email }).email, email).toBeTruthy();
    }
  });
});

describe("phone", () => {
  it("formats a ten-digit number as it is typed", () => {
    expect(formatPhone("6175550142")).toBe("+1 617 555 0142");
    expect(formatPhone("(617) 555-0142")).toBe("+1 617 555 0142");
    expect(formatPhone("1-617-555-0142")).toBe("+1 617 555 0142");
  });

  it("formats partial input without jumping ahead", () => {
    expect(formatPhone("617")).toBe("+1 617");
    expect(formatPhone("617555")).toBe("+1 617 555");
    expect(formatPhone("61755501")).toBe("+1 617 555 01");
  });

  it("leaves a non-NANP number alone rather than guessing its grouping", () => {
    // +44 numbers do not group as 3-3-4, and reshaping them would corrupt a valid number.
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("+33 1 42 68 53 00")).toBe("+33 1 42 68 53 00");
  });

  it("clears to empty rather than leaving a stray prefix", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("   ")).toBe("");
  });

  it("rejects a number too short or too long to be one", () => {
    expect(validateBillingForm({ ...empty, phone: "12345" }).phone).toBeTruthy();
    expect(validateBillingForm({ ...empty, phone: "+1 234567890123456789" }).phone).toBeTruthy();
  });

  it("accepts a plausible international number", () => {
    expect(validateBillingForm({ ...empty, phone: "+44 20 7946 0958" }).phone).toBeUndefined();
  });
});

describe("country and state", () => {
  it("offers a country list, all two-letter codes", () => {
    expect(COUNTRIES.length).toBeGreaterThan(5);
    for (const c of COUNTRIES) expect(c.code, c.name).toMatch(/^[A-Z]{2}$/);
  });

  it("lists the subdivisions of the two countries that have them", () => {
    expect(SUBDIVISIONS.US).toHaveLength(51); // 50 states plus DC
    expect(SUBDIVISIONS.CA).toHaveLength(13);
    expect(SUBDIVISIONS.US.some((s) => s.code === "MA")).toBe(true);
    expect(SUBDIVISIONS.CA.some((s) => s.code === "ON")).toBe(true);
  });

  it("rejects a state that is not in the chosen country's list", () => {
    // Ontario is not a US state; picking US afterwards must not leave it valid.
    expect(validateBillingForm({ ...full, country: "US", state: "ON" }).state).toBeTruthy();
    expect(validateBillingForm({ ...full, country: "CA", state: "ON", postalCode: "K1A 0B1" }).state).toBeUndefined();
  });

  it("accepts free-text regions where there is no list", () => {
    expect(
      validateBillingForm({ ...empty, line1: "1 Main St", country: "DE", state: "Bayern", postalCode: "80331" }).state
    ).toBeUndefined();
  });

  it("rejects a country that is not a two-letter code", () => {
    expect(validateBillingForm({ ...empty, country: "United States" }).country).toBeTruthy();
  });
});

describe("postal code", () => {
  it("checks the shape for the countries whose shape is known", () => {
    const at = (country: string, postalCode: string) =>
      validateBillingForm({ ...empty, line1: "1 Main St", country, postalCode }).postalCode;

    expect(at("US", "02155")).toBeUndefined();
    expect(at("US", "02155-1234")).toBeUndefined();
    expect(at("US", "2155")).toBeTruthy();
    expect(at("US", "ABCDE")).toBeTruthy();

    expect(at("CA", "K1A 0B1")).toBeUndefined();
    expect(at("CA", "K1A0B1")).toBeUndefined();
    expect(at("CA", "12345")).toBeTruthy();

    expect(at("GB", "SW1A 1AA")).toBeUndefined();
    expect(at("GB", "!!!")).toBeTruthy();

    expect(at("AU", "3000")).toBeUndefined();
    expect(at("AU", "30000")).toBeTruthy();
  });

  it("does not invent a rule for a country it has none for", () => {
    expect(
      validateBillingForm({ ...empty, line1: "1 Main St", country: "SG", postalCode: "018956" }).postalCode
    ).toBeUndefined();
  });

  it("has no rule to apply when no country is chosen", () => {
    expect(validateBillingForm({ ...empty, line1: "1 Main St", postalCode: "whatever" }).postalCode).toBeUndefined();
  });
});

describe("a half-finished address", () => {
  it("asks for the street before the rest", () => {
    // A postcode with no street cannot be delivered to; Stripe would take it regardless.
    expect(validateBillingForm({ ...empty, postalCode: "02155", country: "US" }).line1).toBeTruthy();
    expect(validateBillingForm({ ...empty, city: "Medford" }).line1).toBeTruthy();
    expect(validateBillingForm({ ...empty, country: "US", state: "MA" }).line1).toBeTruthy();
  });

  it("does not ask for one when the address is untouched", () => {
    expect(validateBillingForm({ ...empty, name: "Acme", email: "a@b.co" }).line1).toBeUndefined();
  });

  it("is satisfied once the street is there", () => {
    expect(
      validateBillingForm({ ...empty, line1: "3 Ashland Street", city: "Medford", country: "US", postalCode: "02155" })
    ).toEqual({});
  });
});

describe("length caps", () => {
  it("stops a value longer than the endpoint would store", () => {
    const long = "x".repeat(201);
    expect(validateBillingForm({ ...empty, name: long }).name).toBeTruthy();
    expect(validateBillingForm({ ...empty, line1: long }).line1).toBeTruthy();
    expect(validateBillingForm({ ...empty, city: long, line1: "1 Main St" }).city).toBeTruthy();
  });
});

describe("isBillingFormValid", () => {
  it("is the gate the Save button uses", () => {
    expect(isBillingFormValid(full)).toBe(true);
    expect(isBillingFormValid({ ...full, email: "nope" })).toBe(false);
    expect(isBillingFormValid({ ...full, postalCode: "2155" })).toBe(false);
  });
});
