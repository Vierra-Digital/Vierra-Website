/**
 * Shaping Stripe's customer billing fields into the rows the Billing Information card prints.
 *
 * Pulled out of the component because it is the part that can quietly go wrong: Stripe returns
 * every address part as its own nullable field, so a customer who filled in three of six would
 * render blank rows where the rest should be, and the card's columns would stop lining up.
 */

export type BillingAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type BillingDetails = {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: BillingAddress | null;
};

/**
 * Whether an address object carries anything.
 *
 * Stripe returns every field as an empty string rather than dropping the object when an address is
 * cleared, so `address` stays truthy while holding nothing. Left unchecked, the card counted that
 * as "has details" and then rendered no address rows and no "not set" message either — an empty
 * space where one or the other belonged.
 */
function hasAddress(address: BillingAddress | null | undefined): boolean {
  if (!address) return false;
  return Object.values(address).some((value) => typeof value === "string" && value.trim() !== "");
}

/** Whether Stripe holds anything at all for this customer beyond an id. */
export function hasBillingDetails(details: BillingDetails | null | undefined): boolean {
  return !!details && !!(details.name || details.email || details.phone || hasAddress(details.address));
}

/**
 * The rows to print, in the order an invoice reads them, with empty ones dropped.
 *
 * A row with an empty label is a continuation of the one above it — city/state/postcode sit under
 * the street without repeating "Address" three times.
 */
export function billingRows(details: BillingDetails): [string, string][] {
  const address = details.address;
  const locality = [address?.city, address?.state, address?.postalCode].filter(Boolean).join(", ");
  const lines: [string, string | null | undefined][] = [
    ["Billed To", details.name],
    ["Email", details.email],
    ["Phone", details.phone],
    ["Billing Address", address?.line1],
    ["", address?.line2],
    ["", locality || null],
    ["Country", address?.country],
  ];
  return lines.filter((row): row is [string, string] => !!row[1]);
}
