import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { asQueryStr } from "@/lib/api/parsing";
import { screenCartographyQuery } from "@/lib/cartography/screenQuery";

export type CartographySearchResult = {
  company: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string | null;
  title: string | null;
  distanceMiles: number | null;
};

type Row = {
  company: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  title: string | null;
  distance_miles: number | null;
};

const MAX_RESULTS = 50;

// Discovery is shared by authenticated company members. company_id records the contributor;
// source edits retain ownership checks, while imports belong to the requesting user.

/**
 * Turns a free-text query into a prefix-matching tsquery string (e.g. "dental clin" ->
 * "dental:* & clin:*") so a still-being-typed word matches instead of requiring the whole
 * word — plainto_tsquery has no prefix support at all. Each token is stripped to
 * alphanumerics before being handed to to_tsquery, since tsquery's own mini-language
 * (&, |, !, (, ), :) would otherwise misparse punctuation in the input; this is defense
 * against a malformed query erroring the whole request, not a security boundary — the value
 * still only ever reaches Postgres as a bound parameter, never concatenated SQL.
 * Returns null when nothing usable survives (e.g. a query of pure punctuation).
 */
export function buildPrefixTsQuery(q: string): string | null {
  const terms = q
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .slice(0, 8); // matches screenCartographyQuery's length cap in spirit — a bound on query cost
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(" & ") : null;
}

/**
 * Cartography's Search-mode backend (see docs/CARTOGRAPHY_DESIGN.md Rollout M3). Queries the
 * real cartography_companies/cartography_contacts tables — replaces
 * CartographySection.tsx's client-side MOCK_BRAND_UNIVERSE filtering once the UI is rewired
 * onto this endpoint.
 *
 * Runs the keyword (`q`) through screenCartographyQuery() before querying — the design doc's
 * Query screening section calls for both branches to be screened, not just Agentic mode; this
 * closes that loose end. Only `q` is screened (it's the one natural-language field here —
 * centerLat/centerLng/radiusMiles are numeric filters, nothing to screen), and only when
 * present — a location-only search with no keyword has nothing to reject.
 *
 * All filters are optional and expressed as "$1::type IS NULL OR <condition>" in one fixed
 * SQL statement rather than dynamically composed query strings — every value still goes
 * through Prisma's tagged-template parameterization (no string concatenation into SQL), this
 * just avoids building a second, riskier code path for "only some filters are present."
 */
export default withAuth(
  async (req, res) => {
    const q = asQueryStr(req.query.q) || null;
    const centerLat = req.query.centerLat ? Number(asQueryStr(req.query.centerLat)) : null;
    const centerLng = req.query.centerLng ? Number(asQueryStr(req.query.centerLng)) : null;
    const radiusMiles = req.query.radiusMiles ? Number(asQueryStr(req.query.radiusMiles)) : null;

    const hasCenter =
      centerLat !== null && Number.isFinite(centerLat) && centerLng !== null && Number.isFinite(centerLng);
    const prefixQuery = q ? buildPrefixTsQuery(q) : null;

    if (q) {
      const screening = screenCartographyQuery(q);
      if (!screening.ok) {
        // Not persisted as a cartography_runs row like Agentic mode's rejections are — that
        // table's mode CHECK constraint only allows 'general'/'client_spec', neither of which
        // honestly describes a rejected pool lookup, and misusing it to force a fit would be
        // worse than the console record below. A dedicated audit path for search-mode
        // rejections is a follow-up, not something to force into the run-oriented schema now.
        console.warn(`[cartography] search query rejected by screening: ${screening.reason}`);
        res.status(400).json({ message: screening.reason });
        return;
      }
    }

    try {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          co.name AS company,
          co.domain AS domain,
          co.industry AS industry,
          co.description AS description,
          co.address AS location,
          co.lat AS lat,
          co.lng AS lng,
          cc.name AS contact_name,
          cc.title AS title,
          COALESCE(ts_rank_cd(co.search_vector, to_tsquery('english', ${prefixQuery})), 0)
            + CASE WHEN ${q}::text IS NOT NULL AND cc.title ILIKE '%' || ${q} || '%' THEN 0.5 ELSE 0 END
            + CASE WHEN ${q}::text IS NOT NULL AND cc.name ILIKE '%' || ${q} || '%' THEN 0.5 ELSE 0 END
            AS relevance,
          CASE
            WHEN ${hasCenter}::boolean AND co.lat IS NOT NULL AND co.lng IS NOT NULL THEN
              3958.8 * 2 * asin(least(1, sqrt(
                power(sin(radians((co.lat - ${centerLat}::float8) / 2)), 2) +
                cos(radians(${centerLat}::float8)) * cos(radians(co.lat)) *
                power(sin(radians((co.lng - ${centerLng}::float8) / 2)), 2)
              )))
            ELSE NULL
          END AS distance_miles
        FROM cartography_contacts cc
        JOIN cartography_companies co ON co.id = cc.cartography_company_id
        WHERE cc.status NOT IN ('rejected', 'duplicate')
          AND (
            ${q}::text IS NULL
            OR co.search_vector @@ to_tsquery('english', ${prefixQuery})
            OR cc.title ILIKE '%' || ${q} || '%'
            OR cc.name ILIKE '%' || ${q} || '%'
          )
          AND (
            NOT ${hasCenter}::boolean
            OR (
              co.lat IS NOT NULL AND co.lng IS NOT NULL
              AND 3958.8 * 2 * asin(least(1, sqrt(
                    power(sin(radians((co.lat - ${centerLat}::float8) / 2)), 2) +
                    cos(radians(${centerLat}::float8)) * cos(radians(co.lat)) *
                    power(sin(radians((co.lng - ${centerLng}::float8) / 2)), 2)
                  ))) <= ${radiusMiles}::float8
            )
          )
        ORDER BY
          CASE
            WHEN cc.title ~* '(ceo|founder|owner|managing partner)' THEN 0
            WHEN cc.title ~* '(cmo|cto|coo|cfo|director|gm\b)' THEN 1
            ELSE 2
          END,
          relevance DESC,
          distance_miles ASC NULLS LAST,
          co.name ASC
        LIMIT ${MAX_RESULTS}
      `;

      const results: CartographySearchResult[] = rows.map((r) => ({
        company: r.company,
        domain: r.domain,
        industry: r.industry,
        description: r.description,
        location: r.location,
        lat: r.lat,
        lng: r.lng,
        contactName: r.contact_name,
        title: r.title,
        distanceMiles: r.distance_miles,
      }));

      res.status(200).json({ results });
    } catch (error) {
      // Same "degrade to an honest error, never a silent empty page" posture as the rest of
      // this app's DB-touching routes.
      console.error("[cartography] search query failed:", error);
      res.status(502).json({ message: "Couldn't reach the Cartography store." });
    }
  },
  { methods: ["GET"] }
);
