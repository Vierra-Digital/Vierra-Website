/**
 * fetch() wrapper for staff-facing panel pages (see docs/ROLE_MODEL_REDESIGN.md's "v2" section,
 * Phase 4/5) — attaches the currently-selected client company (lib/activeClient.tsx) to every
 * request, since a Vierra staff member's own session no longer identifies which client's data a
 * request is about. GET/HEAD requests get it appended to the query string; everything else gets
 * it merged into a JSON body. Centralizes this in one place instead of touching every call site
 * in every PanelPages/*.tsx component individually.
 *
 * Reads from localStorage, not sessionStorage — the Email Panel (pages/panel/email) opens in its
 * own tab (window.open), and sessionStorage is isolated per-tab, so a client selected on the main
 * panel tab would never be visible there at all.
 */
export function panelFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let activeClientId: string | null = null;
  try {
    const raw = localStorage.getItem("vierra_active_client");
    activeClientId = raw ? (JSON.parse(raw) as { id: string }).id : null;
  } catch {
    activeClientId = null;
  }
  if (!activeClientId) return fetch(input, init);

  const method = (init.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    const url = new URL(input, typeof window !== "undefined" ? window.location.origin : undefined);
    if (!url.searchParams.has("companyId")) url.searchParams.set("companyId", activeClientId);
    return fetch(url.toString(), init);
  }

  if (typeof init.body === "string") {
    try {
      const parsed = JSON.parse(init.body);
      if (parsed && typeof parsed === "object" && !("companyId" in parsed)) {
        return fetch(input, { ...init, body: JSON.stringify({ ...parsed, companyId: activeClientId }) });
      }
    } catch {
      /* not a JSON body — nothing to merge into, send as-is */
    }
  }
  return fetch(input, init);
}
