/**
 * Artemis box client — the self-hosted AI machine's own endpoints.
 *
 * `lib/ai/artemis.ts` speaks the OpenAI-compatible passthrough (`/v1/chat/completions`): a bare
 * model, no retrieval. These endpoints sit one level up and are the reason the box exists — the
 * server pulls the brain's Qdrant collection and brand voice in before the model sees the prompt,
 * so `/generate` returns on-brand drafts and `/research` returns a cited report.
 *
 *   ARTEMIS_BOX_URL   override; defaults to ARTEMIS_BASE_URL with the trailing "/v1" removed
 *   ARTEMIS_API_KEY   sent as a bearer token; the box scopes each key to a set of brains
 *
 * Server-side only — never import into client bundles. The key must not reach the browser.
 */

/** Per-project isolation on the box: separate Qdrant collection, separate access policy. */
export type ArtemisBrain = "vierra" | "ndimensions" | (string & {});

export type BoxResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

const API_KEY = process.env.ARTEMIS_API_KEY || "";

/** The native endpoints live at the root; only the passthrough is under /v1. */
const BOX_URL =
  (process.env.ARTEMIS_BOX_URL || "").replace(/\/$/, "") ||
  (process.env.ARTEMIS_BASE_URL || "").replace(/\/$/, "").replace(/\/v1$/, "");

export function artemisBoxConfigured(): boolean {
  return Boolean(BOX_URL);
}

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<BoxResult<T>> {
  if (!artemisBoxConfigured()) {
    return { ok: false, error: "Artemis isn't configured yet. Set ARTEMIS_BASE_URL." };
  }
  // The box is a single machine on a home connection behind a tunnel: a hung request must not
  // hold a serverless function open until the platform kills it.
  const abort = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(`${BOX_URL}${path}`, {
      ...init,
      signal: abort,
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
        ...init.headers,
      },
    });
    const data = (await res.json().catch(() => null)) as (T & { detail?: string }) | null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.detail || `Artemis returned ${res.status}.`,
      };
    }
    if (!data) return { ok: false, status: res.status, error: "Artemis returned an unreadable response." };
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, error: `Artemis did not respond within ${Math.round(timeoutMs / 1000)}s.` };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Artemis." };
  }
}

export function boxHealth(): Promise<BoxResult<{ ok: boolean; model: string }>> {
  return call("/health", { method: "GET" }, 8_000);
}

/**
 * Brand-voice drafts for a topic, grounded in the brain's knowledge base.
 * Returns the model's raw text — several drafts in one string, as the box formats them.
 */
export function boxGenerate(input: {
  topic: string;
  platform: string;
  brain: ArtemisBrain;
}): Promise<BoxResult<{ drafts: string; used_context: boolean }>> {
  // Retrieval plus a 35B model: measured at ~7s, and slower for a cold collection.
  return call("/generate", { method: "POST", body: JSON.stringify({ ...input, think: false }) }, 120_000);
}

/** Multi-cycle web research: sub-queries, read, reflect, then a cited report. */
export function boxResearch(input: {
  question: string;
  brain: ArtemisBrain;
  cycles?: number;
}): Promise<BoxResult<{ report: string; sources: string[]; queries: string[] }>> {
  return call(
    "/research",
    { method: "POST", body: JSON.stringify({ ...input, cycles: input.cycles ?? 2 }) },
    300_000
  );
}
