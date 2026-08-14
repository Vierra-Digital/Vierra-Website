/**
 * Request handlers for the email panel's client-side calls.
 *
 * The panel and its settings page made ~90 hand-rolled `fetch` calls, each repeating the same
 * three things: JSON headers on writes, `await res.json().catch(() => ({}))` to survive an empty
 * or non-JSON body, and `payload?.message || "<fallback>"` to surface the server's error. Any
 * call site that forgot one of those failed in a different way — an unhandled parse error, or a
 * silent failure with no message.
 *
 * Two styles are provided deliberately, because the panel genuinely needs both:
 *   - `requestJson`  → returns a result object; for loaders that degrade quietly.
 *   - `requestOrThrow` → throws with a useful message; for actions already inside try/catch
 *     that surface errors to the user.
 */

/** Discriminated result — never throws on an HTTP error status. */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; message: string; data: unknown };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/** Parse a response body as JSON, tolerating an empty or non-JSON body. */
async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/** Pull the server's error message out of a payload, falling back to a caller-supplied default. */
export function errorMessageFrom(payload: unknown, fallback: string): string {
  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/**
 * Core request. Adds JSON headers when sending a body, parses defensively, and normalizes the
 * failure case into `{ ok: false, message }`. A network/DNS failure resolves to ok:false with
 * status 0 rather than rejecting, so loaders don't need their own try/catch.
 */
export async function requestJson<T = unknown>(
  url: string,
  init: RequestInit & { json?: unknown; fallbackMessage?: string } = {}
): Promise<ApiResult<T>> {
  const { json, fallbackMessage = "Request failed.", headers, ...rest } = init;
  try {
    const response = await fetch(url, {
      ...rest,
      headers: json === undefined ? headers : { ...JSON_HEADERS, ...headers },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      return { ok: false, status: response.status, message: errorMessageFrom(payload, fallbackMessage), data: payload };
    }
    return { ok: true, status: response.status, data: payload as T };
  } catch {
    return { ok: false, status: 0, message: fallbackMessage, data: {} };
  }
}

/** Throwing variant, for call sites already wrapped in try/catch that show the message. */
export async function requestOrThrow<T = unknown>(
  url: string,
  init: RequestInit & { json?: unknown; fallbackMessage?: string } = {}
): Promise<T> {
  const result = await requestJson<T>(url, init);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/* ── Verb shorthands ────────────────────────────────────────────────────────────────────── */

export const getJson = <T = unknown>(url: string, fallbackMessage?: string) =>
  requestJson<T>(url, { fallbackMessage });

export const postJson = <T = unknown>(url: string, json?: unknown, fallbackMessage?: string) =>
  requestJson<T>(url, { method: "POST", json: json ?? {}, fallbackMessage });

export const patchJson = <T = unknown>(url: string, json?: unknown, fallbackMessage?: string) =>
  requestJson<T>(url, { method: "PATCH", json: json ?? {}, fallbackMessage });

export const putJson = <T = unknown>(url: string, json?: unknown, fallbackMessage?: string) =>
  requestJson<T>(url, { method: "PUT", json: json ?? {}, fallbackMessage });

export const deleteJson = <T = unknown>(url: string, json?: unknown, fallbackMessage?: string) =>
  requestJson<T>(url, { method: "DELETE", ...(json === undefined ? {} : { json }), fallbackMessage });

/* ── Payload helpers ────────────────────────────────────────────────────────────────────── */

/** Read an array off a payload key, defaulting to [] — the panel's most common shape. */
export function arrayFrom<T = unknown>(payload: unknown, key: string): T[] {
  const value = (payload as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Build a query string from defined, non-empty values (skips undefined/null/""). */
export function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
