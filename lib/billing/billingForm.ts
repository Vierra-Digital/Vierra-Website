/**
 * What the Edit Billing Information dialog will accept, and how it formats what it accepts.
 *
 * Pulled out of the component so the rules are testable without rendering a modal, and so the
 * endpoint and the form cannot drift into disagreeing about what a valid address is.
 *
 * The dialog follows the panel's other forms (Invite Staff, Edit Staff): the primary button stays
 * disabled until every field is acceptable, so a submit cannot fail on something the form already
 * knew about.
 */

export type BillingForm = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type FieldErrors = Partial<Record<keyof BillingForm, string>>;

/**
 * Countries the form offers.
 *
 * Deliberately short rather than all 249: these are where Vierra's clients are, and a list of
 * every country makes the common case slower to reach. The endpoint accepts any valid two-letter
 * code, so nothing here caps what Stripe can hold.
 */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
];

/** US states and DC, plus the Canadian provinces, since those are the two subdivided countries here. */
export const SUBDIVISIONS: Record<string, { code: string; name: string }[]> = {
  US: [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
    ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
    ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
    ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
    ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
    ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
    ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
    ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
    ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
    ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
    ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ].map(([code, name]) => ({ code, name })),
  CA: [
    ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
    ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
    ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
    ["SK", "Saskatchewan"], ["YT", "Yukon"],
  ].map(([code, name]) => ({ code, name })),
};

/** Postal formats for the countries whose shape is worth checking before Stripe rejects it. */
const POSTAL_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, hint: "A US ZIP code is 5 digits, or 5+4." },
  CA: { pattern: /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/, hint: "A Canadian postal code looks like K1A 0B1." },
  GB: { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?[ ]?\d[A-Za-z]{2}$/, hint: "A UK postcode looks like SW1A 1AA." },
  AU: { pattern: /^\d{4}$/, hint: "An Australian postcode is 4 digits." },
  NZ: { pattern: /^\d{4}$/, hint: "A New Zealand postcode is 4 digits." },
  DE: { pattern: /^\d{5}$/, hint: "A German postal code is 5 digits." },
  FR: { pattern: /^\d{5}$/, hint: "A French postal code is 5 digits." },
  IN: { pattern: /^\d{6}$/, hint: "An Indian PIN code is 6 digits." },
};

/**
 * A North American number, formatted as it is typed.
 *
 * Only NANP numbers are reshaped; anything starting with a different country code is left as the
 * person typed it, because guessing at the grouping of an unfamiliar country's number is worse
 * than leaving it alone.
 */
export function formatPhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") return "";

  // A leading + and a country code that is not 1 means we do not know the grouping.
  if (/^\+(?!1\b)/.test(trimmed) && !/^\+1/.test(trimmed)) {
    return trimmed.replace(/[^\d+\s()-]/g, "").slice(0, 24);
  }

  const digits = trimmed.replace(/\D/g, "");
  const national = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);
  if (national.length === 0) return trimmed.startsWith("+") ? "+1 " : "";

  const area = national.slice(0, 3);
  const prefix = national.slice(3, 6);
  const line = national.slice(6, 10);
  let out = `+1 ${area}`;
  if (prefix) out += ` ${prefix}`;
  if (line) out += ` ${line}`;
  return out;
}

/** Digits only, for length checks that should ignore formatting. */
const phoneDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Every field is optional — Stripe holds nothing for most customers and clearing a value is a
 * legitimate edit. What is checked is the shape of anything actually filled in.
 */
export function validateBillingForm(form: BillingForm): FieldErrors {
  const errors: FieldErrors = {};
  const t = (v: string) => v.trim();

  if (t(form.name).length > 200) errors.name = "Keep this under 200 characters.";

  const email = t(form.email);
  if (email) {
    // One @, something either side, a dot in the domain. Deliberately not an RFC-complete
    // pattern — those reject addresses that deliver perfectly well.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "That does not look like an email address.";
    else if (email.length > 200) errors.email = "Keep this under 200 characters.";
  }

  const phone = t(form.phone);
  if (phone) {
    const digits = phoneDigits(phone);
    if (digits.length < 7) errors.phone = "That is too short to be a phone number.";
    else if (digits.length > 15) errors.phone = "That is too long to be a phone number.";
  }

  if (t(form.line1).length > 200) errors.line1 = "Keep this under 200 characters.";
  if (t(form.line2).length > 200) errors.line2 = "Keep this under 200 characters.";
  if (t(form.city).length > 200) errors.city = "Keep this under 200 characters.";

  const country = t(form.country).toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) errors.country = "Pick a country from the list.";

  // A subdivision is only checkable for the countries we list one for.
  const subdivisions = SUBDIVISIONS[country];
  const state = t(form.state);
  if (state && subdivisions && !subdivisions.some((s) => s.code === state.toUpperCase())) {
    errors.state = "Pick a state from the list.";
  }

  const postal = t(form.postalCode);
  if (postal) {
    const rule = POSTAL_RULES[country];
    if (rule && !rule.pattern.test(postal)) errors.postalCode = rule.hint;
    else if (postal.length > 32) errors.postalCode = "That is too long to be a postal code.";
  }

  /**
   * A postal code or a state with no street is an address that cannot be delivered to. Stripe
   * accepts it, but it is almost always a half-finished edit rather than an intention.
   */
  if (!t(form.line1) && (postal || state || t(form.city))) {
    errors.line1 = "Add the street before the rest of the address.";
  }

  return errors;
}

/** Whether the form is safe to submit. */
export function isBillingFormValid(form: BillingForm): boolean {
  return Object.keys(validateBillingForm(form)).length === 0;
}
