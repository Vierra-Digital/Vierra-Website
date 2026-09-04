/**
 * Shared request-parsing helpers for API routes.
 *
 * These consolidate the many local `asStr` / `asString` / `asQueryStr` / `asPort`
 * helpers that were copy-pasted across pages/api. Two distinct shapes exist:
 *  - body fields arrive as `unknown`  -> use `asStr`
 *  - query params arrive as `string | string[] | undefined` -> use `asQueryStr`
 * Both trim and default to "" (the dominant prior behavior).
 */

/** Coerce an unknown body value to a trimmed string (""" if not a string). */
export function asStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** First element of a query param (or the value), trimmed; "" if absent. */
export function asQueryStr(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Whether a string is a well-formed UUID.
 *
 * Several public routes take an id straight from the URL into a `@db.Uuid` column. Postgres
 * rejects anything that is not a UUID before the row lookup happens, Prisma raises P2007, and the
 * route's catch block turns that into a 500 — so /api/blog/image/abc answered 500 while
 * /api/blog/image/<a real-looking but absent uuid> correctly answered 404. Same class of request,
 * two different answers, and the 500s fill the error log with traffic that is just scanners.
 *
 * Checking the shape first lets those routes answer 404 for both cases. Deliberately a shape test
 * and not a version/variant test: the point is to avoid handing Postgres something it will reject,
 * not to police which UUID version generated it.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_SHAPE.test(value);
}

/** Coerce to a positive integer port, falling back when invalid. */
export function asPort(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}

/** A query-param `accountEmail`, trimmed + lowercased; "" if absent. */
export function queryAccountEmail(value: string | string[] | undefined): string {
  return asQueryStr(value).toLowerCase();
}
