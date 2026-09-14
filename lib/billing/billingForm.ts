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
 * Every ISO 3166-1 alpha-2 country.
 *
 * Codes are the data; names come from Intl.DisplayNames so there is no hand-typed table of 249
 * strings to fall out of date, and each reader sees them in their own locale. Sorted by the
 * displayed name rather than by code, because that is the order someone scans.
 */
// Parenthesised: .split binds tighter than +, so without it only the last literal is split.
const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO " +
  "FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE " +
  "JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO " +
  "MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW " +
  "PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM " +
  "TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

function countryName(code: string): string {
  try {
    // Intl.DisplayNames is in every runtime this ships to; the fallback is the code itself.
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export const COUNTRIES: { code: string; name: string }[] = COUNTRY_CODES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name));

/**
 * Subdivisions for the countries whose postal addresses actually carry one.
 *
 * Not every country: most address formats have no state field at all, and offering an invented
 * list would reject regions that are perfectly real. Anything not listed keeps a free-text field.
 */
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
  AU: [
    ["ACT", "Australian Capital Territory"], ["NSW", "New South Wales"], ["NT", "Northern Territory"],
    ["QLD", "Queensland"], ["SA", "South Australia"], ["TAS", "Tasmania"], ["VIC", "Victoria"],
    ["WA", "Western Australia"],
  ].map(([code, name]) => ({ code, name })),
  MX: [
    ["AGU", "Aguascalientes"], ["BCN", "Baja California"], ["BCS", "Baja California Sur"], ["CAM", "Campeche"],
    ["CHP", "Chiapas"], ["CHH", "Chihuahua"], ["CMX", "Ciudad de México"], ["COA", "Coahuila"],
    ["COL", "Colima"], ["DUR", "Durango"], ["GUA", "Guanajuato"], ["GRO", "Guerrero"], ["HID", "Hidalgo"],
    ["JAL", "Jalisco"], ["MEX", "México"], ["MIC", "Michoacán"], ["MOR", "Morelos"], ["NAY", "Nayarit"],
    ["NLE", "Nuevo León"], ["OAX", "Oaxaca"], ["PUE", "Puebla"], ["QUE", "Querétaro"],
    ["ROO", "Quintana Roo"], ["SLP", "San Luis Potosí"], ["SIN", "Sinaloa"], ["SON", "Sonora"],
    ["TAB", "Tabasco"], ["TAM", "Tamaulipas"], ["TLA", "Tlaxcala"], ["VER", "Veracruz"], ["YUC", "Yucatán"],
    ["ZAC", "Zacatecas"],
  ].map(([code, name]) => ({ code, name })),
  BR: [
    ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
    ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
    ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
    ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
    ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"],
    ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
  ].map(([code, name]) => ({ code, name })),
  IN: [
    ["AN", "Andaman and Nicobar Islands"], ["AP", "Andhra Pradesh"], ["AR", "Arunachal Pradesh"], ["AS", "Assam"],
    ["BR", "Bihar"], ["CH", "Chandigarh"], ["CT", "Chhattisgarh"], ["DH", "Dadra and Nagar Haveli and Daman and Diu"],
    ["DL", "Delhi"], ["GA", "Goa"], ["GJ", "Gujarat"], ["HR", "Haryana"], ["HP", "Himachal Pradesh"],
    ["JK", "Jammu and Kashmir"], ["JH", "Jharkhand"], ["KA", "Karnataka"], ["KL", "Kerala"], ["LA", "Ladakh"],
    ["LD", "Lakshadweep"], ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"], ["ML", "Meghalaya"],
    ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OR", "Odisha"], ["PY", "Puducherry"], ["PB", "Punjab"],
    ["RJ", "Rajasthan"], ["SK", "Sikkim"], ["TN", "Tamil Nadu"], ["TG", "Telangana"], ["TR", "Tripura"],
    ["UP", "Uttar Pradesh"], ["UT", "Uttarakhand"], ["WB", "West Bengal"],
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Not a valid email address.";
    else if (email.length > 200) errors.email = "Keep this under 200 characters.";
  }

  const phone = t(form.phone);
  if (phone) {
    const digits = phoneDigits(phone);
    if (digits.length < 7 || digits.length > 15) errors.phone = "Not a valid phone number.";
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
   * An address is all-or-nothing.
   *
   * Leaving every address field blank is fine — most customers have none. But a street with no
   * city, or a city with no country, is an address that cannot be delivered to; Stripe accepts it
   * and the invoice then carries a fragment. Once any part is filled the rest are required, so the
   * Save button stays greyed out until the address is one a letter could reach.
   */
  const addressStarted = !!(t(form.line1) || t(form.line2) || t(form.city) || state || postal || country);
  if (addressStarted) {
    if (!t(form.line1)) errors.line1 = "A street address is required.";
    if (!t(form.city)) errors.city = "A city is required.";
    if (!country) errors.country = "A country is required.";
    // Only where the country actually uses one — Ireland and Hong Kong, among others, do not.
    if (!postal && country && POSTAL_RULES[country]) errors.postalCode = "A postal code is required.";
    // Only where we list subdivisions; elsewhere the field is optional free text.
    if (!state && subdivisions) errors.state = "A state is required.";
  }

  return errors;
}

/** Whether the form is safe to submit. */
export function isBillingFormValid(form: BillingForm): boolean {
  return Object.keys(validateBillingForm(form)).length === 0;
}
