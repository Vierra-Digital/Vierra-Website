/**
 * Query screening gate for Cartography (see docs/CARTOGRAPHY_DESIGN.md's "Query screening"
 * section). Runs before EITHER branch — Search mode's pool lookup and Agentic mode's ICP
 * description alike — not just in front of the AI call, since both share one input box and
 * one submit path.
 *
 * Pure and import-safe (no Next/Prisma/network) so it's unit-testable in isolation, same as
 * lib/ai/artemis.ts.
 */

export type ScreenResult = { ok: true } | { ok: false; reason: string };

const MAX_QUERY_LENGTH = 500;

// Phrases shaped like an attempt to override or redirect whatever prompt this query later
// gets concatenated into (Agentic mode's Artemis call). Search mode's query becomes a DB
// filter, not a prompt, but the gate is uniform per the design doc — one entry point,
// one gate.
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions?/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*prompt/i,
  /\[\s*(system|assistant)\s*\]/i,
  /<\|.*?\|>/,
];

// Matches the specific fact pattern flagged in the design doc's Open questions: pulling
// reviewer/rating-linked names, then trying to contact them individually. Requires BOTH
// signals together — review language alone ("what do reviews say about X") and
// contact-seeking language alone ("find dental clinics") are both ordinary, legitimate
// queries; only the combination is the risky pattern.
const REVIEW_LANGUAGE = /\b(review|reviewer|rating|star)s?\b/i;
const CONTACT_SEEKING_LANGUAGE = /\b(contact|find|email|phone|reach|name|address)\b/i;

// A named individual addressed by honorific — a much stronger, lower-false-positive signal
// than "two capitalized words in a row," which also matches ordinary company and city names
// ("Nova Dental", "Round Rock") and would false-positive constantly.
const HONORIFIC_NAME_PATTERN = /\b(mr|mrs|ms|mx|dr)\.?\s+[A-Z][a-z]+/i;

export function screenCartographyQuery(rawQuery: string): ScreenResult {
  const query = rawQuery.trim();

  if (!query) {
    return { ok: false, reason: "Query is empty." };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, reason: `Query is too long (max ${MAX_QUERY_LENGTH} characters).` };
  }
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      return { ok: false, reason: "Query contains disallowed instruction-like content." };
    }
  }
  if (REVIEW_LANGUAGE.test(query) && CONTACT_SEEKING_LANGUAGE.test(query)) {
    return {
      ok: false,
      reason:
        "This reads as sourcing leads from reviewers/ratings rather than companies or decision-makers — that flow needs legal sign-off before it's built (see docs/CARTOGRAPHY_DESIGN.md's Open questions).",
    };
  }
  if (HONORIFIC_NAME_PATTERN.test(query)) {
    return {
      ok: false,
      reason:
        "This looks like it's targeting a specific named individual rather than a company or industry. Cartography sources companies/decision-makers, not private individuals.",
    };
  }

  return { ok: true };
}
