import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

export type CartographyLocation = {
  location: string;
  lat: number;
  lng: number;
  count: number;
};

type Row = {
  city: string;
  state: string;
  lat: number;
  lng: number;
  count: bigint;
};

const MAX_LOCATIONS = 200;

/**
 * Cartography's location picker backend. The Discover screen's "center city" dropdown used to
 * be a hardcoded list of 8 cities lifted from the seed-test-data script — meaningless once a
 * real 16k-row lead pool exists, since none of those cities necessarily have any real
 * companies in them. This derives the picker from the shared pool across all companies: every
 * distinct city/state that has at least one geocoded company, centered on the average
 * lat/lng of that city's companies (addresses within a city vary by a few blocks at most, so
 * an average is a fine stand-in for a true city centroid without a separate geocoding step).
 *
 * City/state aren't their own columns (see prisma/manual/20260831_cartography_schema.sql) —
 * `address` is free text in the "Street, City, ST ZIP" shape produced by the CSV import
 * (prisma/manual/20260901_import_vierra_brand_universe_leads.sql) and by the seed script's
 * plain "City, ST" rows. Both shapes end in ", City, ST[ ZIP]" or ", ST[ ZIP]", so splitting on
 * ", " and reading the last two segments (dropping any trailing ZIP) recovers city/state
 * without a schema change or a backfill of every existing row.
 */
export default withAuth(
  async (req, res) => {
    try {
      const rows = await prisma.$queryRaw<Row[]>`
        WITH parsed AS (
          SELECT
            lat,
            lng,
            trim(parts[array_length(parts, 1) - 1]) AS city,
            split_part(trim(parts[array_length(parts, 1)]), ' ', 1) AS state
          FROM (
            SELECT lat, lng, regexp_split_to_array(address, ',\s*') AS parts
            FROM cartography_companies
            WHERE address IS NOT NULL
              AND lat IS NOT NULL
              AND lng IS NOT NULL
          ) split
          WHERE array_length(parts, 1) >= 2
        )
        SELECT city, state, avg(lat)::float8 AS lat, avg(lng)::float8 AS lng, count(*) AS count
        FROM parsed
        WHERE city <> '' AND state ~ '^[A-Za-z]{2}$'
        GROUP BY city, state
        ORDER BY count DESC, city ASC
        LIMIT ${MAX_LOCATIONS}
      `;

      const results: CartographyLocation[] = rows.map((r) => ({
        location: `${r.city}, ${r.state.toUpperCase()}`,
        lat: r.lat,
        lng: r.lng,
        count: Number(r.count),
      }));

      res.status(200).json({ results });
    } catch (error) {
      console.error("[cartography] locations list failed:", error);
      res.status(502).json({ message: "Couldn't reach the Cartography store." });
    }
  },
  { methods: ["GET"] }
);
