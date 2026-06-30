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

/** Coerce to a positive integer port, falling back when invalid. */
export function asPort(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}
