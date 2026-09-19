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

  it("says so plainly rather than describing the length", () => {
    expect(validateBillingForm({ ...empty, phone: "12345" }).phone).toBe("Not a valid phone number.");
    expect(validateBillingForm({ ...empty, email: "nope" }).email).toBe("Not a valid email address.");
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
  it("offers every country, all two-letter codes, sorted by name", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    for (const c of COUNTRIES) expect(c.code, c.name).toMatch(/^[A-Z]{2}$/);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    // Named, not left as bare codes.
    expect(COUNTRIES.find((c) => c.code === "US")?.name).toBe("United States");
  });

  it("lists the subdivisions of the countries whose addresses carry one", () => {
    expect(SUBDIVISIONS.US).toHaveLength(51); // 50 states plus DC
    expect(SUBDIVISIONS.CA).toHaveLength(13);
    expect(SUBDIVISIONS.AU).toHaveLength(8);
    expect(SUBDIVISIONS.MX).toHaveLength(32);
    expect(SUBDIVISIONS.BR).toHaveLength(27);
    expect(SUBDIVISIONS.IN).toHaveLength(36);
    expect(SUBDIVISIONS.US.some((s) => s.code === "MA")).toBe(true);
    expect(SUBDIVISIONS.CA.some((s) => s.code === "ON")).toBe(true);
    // Every listed country is one the form actually offers.
    for (const code of Object.keys(SUBDIVISIONS)) {
      expect(COUNTRIES.some((c) => c.code === code), code).toBe(true);
    }
  });

  it("rejects a state that is not in the chosen country's list", () => {
    // Ontario is not a US state; picking US afterwards must not leave it valid.
    expect(validateBillingForm({ ...full, country: "US", state: "ON" }).state).toBeTruthy();
    expect(validateBillingForm({ ...full, country: "CA", state: "ON", postalCode: "K1A 0B1" }).state).toBeUndefined();
  });

  it("accepts free-text regions where there is no list", () => {
    expect(
      validateBillingForm({ ...empty, line1: "1 Main St", city: "Munich", country: "DE", state: "Bayern", postalCode: "80331" }).state
    ).toBeUndefined();
  });

  it("rejects a country that is not a two-letter code", () => {
    expect(validateBillingForm({ ...empty, country: "United States" }).country).toBeTruthy();
  });
});

describe("postal code", () => {
  it("checks the shape for the countries whose shape is known", () => {
    // A complete address around the code, so the all-or-nothing rule does not mask the shape check.
    const at = (country: string, postalCode: string) =>
      validateBillingForm({
        ...empty,
        line1: "1 Main St",
        city: "Town",
        state: SUBDIVISIONS[country]?.[0]?.code ?? "",
        country,
        postalCode,
      }).postalCode;

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
      validateBillingForm({ ...empty, line1: "1 Main St", city: "Singapore", country: "SG", postalCode: "018956" }).postalCode
    ).toBeUndefined();
  });

  it("has no rule to apply when no country is chosen", () => {
    // The country itself is what gets reported missing, not the shape of the code.
    const noCountry = validateBillingForm({ ...empty, line1: "1 Main St", city: "Town", postalCode: "whatever" });
    expect(noCountry.postalCode).toBeUndefined();
    expect(noCountry.country).toBeTruthy();
  });
});

describe("an address is all-or-nothing", () => {
  it("asks for the missing parts as soon as one is filled", () => {
    // A fragment cannot be delivered to, and Stripe would print it on an invoice as given.
    const started = validateBillingForm({ ...empty, line1: "3 Ashland Street" });
    expect(started.city).toBeTruthy();
    expect(started.country).toBeTruthy();
  });

  it("names the street when the rest was filled without it", () => {
    expect(validateBillingForm({ ...empty, postalCode: "02155", country: "US" }).line1).toBeTruthy();
    expect(validateBillingForm({ ...empty, city: "Medford" }).line1).toBeTruthy();
  });

  it("does not ask for anything when the address is untouched", () => {
    // Most customers have no address at all, and saving that is legitimate.
    expect(validateBillingForm({ ...empty, name: "Acme", email: "a@b.co" })).toEqual({});
  });

  it("is satisfied by a complete one", () => {
    expect(
      validateBillingForm({
        ...empty,
        line1: "3 Ashland Street",
        city: "Medford",
        state: "MA",
        postalCode: "02155",
        country: "US",
      })
    ).toEqual({});
  });

  it("requires a state only where subdivisions are listed", () => {
    const inUs = validateBillingForm({ ...empty, line1: "1 Main St", city: "Boston", country: "US", postalCode: "02101" });
    expect(inUs.state).toBeTruthy();

    // Singapore addresses carry no state, and none is listed, so none is demanded.
    const inSg = validateBillingForm({ ...empty, line1: "1 Raffles Pl", city: "Singapore", country: "SG" });
    expect(inSg.state).toBeUndefined();
  });

  it("requires a postal code only where the country uses one", () => {
    const inUs = validateBillingForm({ ...empty, line1: "1 Main St", city: "Boston", state: "MA", country: "US" });
    expect(inUs.postalCode).toBeTruthy();

    // Ireland has no rule listed, so a missing Eircode is not invented as an error.
    const inIe = validateBillingForm({ ...empty, line1: "1 Grafton St", city: "Dublin", country: "IE" });
    expect(inIe.postalCode).toBeUndefined();
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
