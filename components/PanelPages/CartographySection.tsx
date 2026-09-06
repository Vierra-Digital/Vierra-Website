import React, { useEffect, useRef, useState } from "react";
import { FiSearch, FiZap, FiInbox, FiExternalLink, FiAlertTriangle } from "react-icons/fi";
import type { CartographySearchResult } from "@/pages/api/cartography/search";
import type { CartographyLocation } from "@/pages/api/cartography/locations";
import ReviewQueue from "@/components/PanelPages/CartographySection/ReviewQueue";
import { companyUrl } from "@/lib/cartography/companyUrl";
import { panelFetch } from "@/lib/panelFetch";

// Shape of a /prospect job's payload once it reaches a terminal status, as cached by
// pages/api/prospect/callback.ts and served by pages/api/prospect/[jobId].ts. Every value on a
// company carries a `basis` — see the rendering rules below, which are the product here, not
// decoration: a misrendered basis or a collapsed confidence/match_ratio pair hides exactly the
// thing the user most needs to see before trusting a result.
type Basis = "attested" | "declared" | "inferred";
type ProspectValue<T> = { value: T; basis?: Basis; source?: string };
type ProspectCompany = {
  name: ProspectValue<string>;
  domain: ProspectValue<string> | null;
  geo?: { city?: ProspectValue<string>; region?: ProspectValue<string> };
  contacts?: Array<{ name?: ProspectValue<string>; title?: ProspectValue<string>; source_url?: string }>;
  signals?: Array<{ kind: string }>;
  raw?: {
    fit?: number;
    components?: { confidence?: number; match_ratio?: number };
    reasons?: string[];
  };
};
type SearchError = { backend: string; kind: "quota" | "unconfigured" | "throttled" | "error"; [k: string]: unknown };
type ProspectJobPayload = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed" | "interrupted";
  stage?: string;
  found?: number;
  error?: string | null;
  spec?: { summary?: string; defaulted_from_seeker?: string[] };
  stats?: {
    rejected_suppression?: number;
    rejected_company?: number;
    search_errors?: SearchError[];
    warnings?: string[];
  };
  results?: ProspectCompany[];
};

type CartographyScreen = "discover" | "review";
type CartographyMode = "search" | "agentic";

const MODE_COPY: Record<CartographyMode, { placeholder: string; hint: string }> = {
  search: {
    placeholder: "Search companies, contacts or industries…",
    hint: "Looks up the existing Cartography pool by keyword — company name, industry, title.",
  },
  agentic: {
    placeholder: 'Describe who you’re looking for — e.g. "ecom brands under 50 employees that just signed with Stripe"',
    hint: "Runs a real partner-discovery search (10–40s) and returns actual companies, each backed by a source URL.",
  },
};

const POLL_INTERVAL_MS = 4000;

const RADIUS_OPTIONS_MILES = [10, 25, 50, 100, 250, 500];

/**
 * Cartography module: a search bar with a mode toggle and a proximity filter (center city +
 * radius). Search mode calls the real /api/cartography/search endpoint (see
 * docs/CARTOGRAPHY_DESIGN.md Rollout M3) — requires the migration + seed data to have been
 * applied; until then it'll surface a "couldn't reach the Cartography store" error, which is
 * the honest behavior rather than silently falling back to fake data. Agentic mode calls
 * /api/cartography/agent (Artemis-backed, screened, sub-agent fan-out — see
 * lib/cartography/agentOrchestrator.ts).
 */
const CartographySection: React.FC = () => {
  const [screen, setScreen] = useState<CartographyScreen>("discover");
  const [mode, setMode] = useState<CartographyMode>("search");
  const [query, setQuery] = useState("");
  const [centerCity, setCenterCity] = useState(""); // "" = no distance filter
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  // Populated from the shared pool (see pages/api/cartography/locations.ts)
  // rather than a fixed list — a hardcoded set of cities would almost certainly not overlap
  // with any real leads once the pool is real data instead of the 8-row seed fixture.
  const [referenceLocations, setReferenceLocations] = useState<CartographyLocation[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cartography/locations")
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (!cancelled) setReferenceLocations(Array.isArray(data?.results) ? data.results : []);
      })
      .catch(() => {
        if (!cancelled) setReferenceLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CartographySearchResult[] | null>(null);

  const [agentLoading, setAgentLoading] = useState(false);
  const [agentStage, setAgentStage] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<ProspectJobPayload | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const copy = MODE_COPY[mode];
  const center = referenceLocations.find((c) => c.location === centerCity) || null;

  const canSubmit = mode === "search" ? Boolean(query.trim()) || Boolean(centerCity) : Boolean(query.trim());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (mode === "search") {
      const trimmed = query.trim();
      setSubmittedQuery(trimmed);
      setSearchLoading(true);
      setSearchError(null);
      setSearchResults(null);
      try {
        const params = new URLSearchParams();
        if (trimmed) params.set("q", trimmed);
        if (center) {
          params.set("centerLat", String(center.lat));
          params.set("centerLng", String(center.lng));
          params.set("radiusMiles", String(radiusMiles));
        }
        const res = await fetch(`/api/cartography/search?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSearchError(data?.message || "The search request failed.");
          return;
        }
        setSearchResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setSearchError("Couldn't reach the search endpoint.");
      } finally {
        setSearchLoading(false);
      }
      return;
    }

    const description = query.trim();
    setSubmittedQuery(description);
    setAgentLoading(true);
    setAgentStage(null);
    setAgentError(null);
    setAgentResult(null);
    if (pollTimer.current) clearTimeout(pollTimer.current);

    try {
      const res = await panelFetch("/api/cartography/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAgentError(data?.message || "The agent request failed.");
        setAgentLoading(false);
        return;
      }
      pollProspectJob(data?.jobId);
    } catch {
      setAgentError("Couldn't reach the agent endpoint.");
      setAgentLoading(false);
    }
  };

  // /prospect runs 10–40s; the callback is best-effort (unauthenticated, so it re-fetches rather
  // than trusting its body — see pages/api/prospect/callback.ts), so polling is the reliable
  // path, not just a fallback. Stops once a job reaches a terminal status ("interrupted" is NOT
  // terminal — Artemis auto-resumes it — so keep polling through that one).
  const pollProspectJob = async (jobId: unknown) => {
    if (typeof jobId !== "string" || !jobId) {
      setAgentError("Artemis did not return a job id.");
      setAgentLoading(false);
      return;
    }
    try {
      const res = await panelFetch(`/api/prospect/${encodeURIComponent(jobId)}`);
      const data = (await res.json().catch(() => ({}))) as Partial<ProspectJobPayload> & { message?: string };
      if (!res.ok) {
        setAgentError(data?.message || "Lost track of the prospect job.");
        setAgentLoading(false);
        return;
      }
      setAgentStage(data.stage ?? null);

      if (data.status === "done" || data.status === "failed") {
        setAgentResult(data as ProspectJobPayload);
        setAgentLoading(false);
        if (data.status === "done") {
          // Best-effort: turns the job into a cartography_runs row for the Review Queue.
          // Failing here never costs the user the results already rendered above.
          panelFetch("/api/cartography/agent/persist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jobId }),
          }).catch(() => {});
        }
        return;
      }

      pollTimer.current = setTimeout(() => pollProspectJob(jobId), POLL_INTERVAL_MS);
    } catch {
      pollTimer.current = setTimeout(() => pollProspectJob(jobId), POLL_INTERVAL_MS);
    }
  };

  // Switching modes changes what a submitted query means (a pool lookup vs. an agent brief),
  // so carrying one mode's submitted state into the other would mislabel it.
  const switchMode = (next: CartographyMode) => {
    setMode(next);
    setSubmittedQuery(null);
    setCenterCity("");
    setSearchLoading(false);
    setSearchError(null);
    setSearchResults(null);
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setAgentLoading(false);
    setAgentStage(null);
    setAgentError(null);
    setAgentResult(null);
  };

  const BASIS_LABEL: Record<Basis, string> = { attested: "sourced", declared: "self-reported", inferred: "inferred" };

  function BasisTag({ basis }: { basis?: Basis }) {
    if (!basis || basis === "attested") return null;
    return (
      <span
        className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          basis === "declared" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        {BASIS_LABEL[basis]}
      </span>
    );
  }

  // Confidence counts unknown attributes against it (see the title on ConfidenceBadge below) --
  // the three tiers below exist so a glance at the color tells the story match_ratio and
  // confidence together are meant to: "everything checked out" (high) vs "some things couldn't
  // be checked" (medium) vs "we checked, and it's wrong" (low, per the rendering rules).
  type ConfidenceTier = "high" | "medium" | "low";
  const CONFIDENCE_TIER_STYLE: Record<ConfidenceTier, { ring: string; border: string; chip: string; dot: string; label: string }> = {
    high: { ring: "ring-emerald-200", border: "border-emerald-200", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Strong match" },
    medium: { ring: "ring-amber-200", border: "border-amber-200", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500", label: "Partial match" },
    low: { ring: "ring-red-200", border: "border-red-200", chip: "bg-red-50 text-red-700", dot: "bg-red-500", label: "Weak match" },
  };
  function confidenceTier(confidence: number): ConfidenceTier {
    if (confidence >= 0.75) return "high";
    if (confidence >= 0.4) return "medium";
    return "low";
  }

  function ConfidenceBadge({ confidence, matchRatio }: { confidence?: number; matchRatio?: number }) {
    if (typeof confidence !== "number") return null;
    const tier = confidenceTier(confidence);
    const style = CONFIDENCE_TIER_STYLE[tier];
    return (
      <div
        className={`flex shrink-0 flex-col items-end gap-1 rounded-xl px-3 py-2 ring-1 ${style.chip} ${style.ring}`}
        title="confidence counts unknowns against it; match_ratio only counts what was actually verified"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="text-lg font-bold leading-none">{Math.round(confidence * 100)}%</span>
        {typeof matchRatio === "number" ? (
          <span className="text-[10px] font-medium opacity-80">ratio {matchRatio.toFixed(2)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white text-[#111014] flex flex-col overflow-y-auto">
      <div className="flex-1 flex justify-center px-6 pb-10">
        <div className="mx-auto w-full max-w-[1680px] flex flex-col">
          <div className="pt-8 pb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Cartography</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Lead sourcing — search the existing pool, or describe a target and let an agent go find one.
            </p>
          </div>

          {/* Discover finds candidates; Review Queue is where they get turned into real
              Contacts. Kept as separate top-level tabs, not folded into the Search/Agentic
              toggle below — sourcing and reviewing are different actions on different data
              (live results vs. the standing candidate pool), not two flavors of one search. */}
          <div
            role="tablist"
            aria-label="Cartography screen"
            className="mb-4 inline-flex w-fit rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={screen === "discover"}
              onClick={() => setScreen("discover")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                screen === "discover" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              <FiSearch className="w-3.5 h-3.5" />
              Discover
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={screen === "review"}
              onClick={() => setScreen("review")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                screen === "review" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              <FiInbox className="w-3.5 h-3.5" />
              Review Queue
            </button>
          </div>

          {screen === "review" ? (
            <ReviewQueue />
          ) : (
          <>
          {/* Mode toggle. Search reads the pool that already exists; Agentic kicks off new
              research. Distinct enough actions that a single input shouldn't quietly mean
              different things depending on unseen state. */}
          <div
            role="radiogroup"
            aria-label="Cartography mode"
            className="mb-4 inline-flex w-fit rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === "search"}
              onClick={() => switchMode("search")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "search" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              <FiSearch className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "agentic"}
              onClick={() => switchMode("agentic")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "agentic" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              <FiZap className="w-3.5 h-3.5" />
              Agentic
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              {mode === "search" ? (
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              ) : (
                <FiZap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
              )}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.placeholder}
                aria-label={mode === "search" ? "Search Cartography" : "Describe a lead target for the agent"}
                className="w-full rounded-md border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0]/25"
              />
            </div>
            {mode === "search" ? (
              <>
                <select
                  value={centerCity}
                  onChange={(event) => setCenterCity(event.target.value)}
                  aria-label="Filter by distance from city"
                  className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0]/25"
                >
                  <option value="">Any location</option>
                  {referenceLocations.map((c) => (
                    <option key={c.location} value={c.location}>
                      {c.location} ({c.count})
                    </option>
                  ))}
                </select>
                <select
                  value={radiusMiles}
                  onChange={(event) => setRadiusMiles(Number(event.target.value))}
                  disabled={!centerCity}
                  aria-label="Distance radius"
                  className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0]/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {RADIUS_OPTIONS_MILES.map((mi) => (
                    <option key={mi} value={mi}>
                      within {mi} mi
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit || agentLoading || searchLoading}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-[#701CC0] px-5 text-sm font-semibold text-white hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === "search" ? (searchLoading ? "Searching…" : "Search") : agentLoading ? "Running…" : "Run agent"}
            </button>
          </form>
          <p className="mt-2 text-xs text-[#9CA3AF]">{copy.hint}</p>

          {mode === "search" && searchLoading ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
              <p className="text-sm font-medium text-[#374151]">Searching…</p>
            </div>
          ) : mode === "search" && searchError ? (
            <div className="mt-8 rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
              <p className="text-sm font-medium text-red-700">Search failed</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-red-600">{searchError}</p>
            </div>
          ) : mode === "search" && searchResults ? (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                  {submittedQuery ? ` for “${submittedQuery}”` : ""}
                  {center ? ` within ${radiusMiles} mi of ${center.location}` : ""}
                </p>
              </div>
              {searchResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
                  <p className="text-sm font-medium text-[#374151]">No matches</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                    Nothing in the pool matches that. Try a company name, industry, title, a
                    wider radius, or a different center city.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#ECEAF1] bg-white">
                  <div className="divide-y divide-[#F1EFF6]">
                    {searchResults.map((r, i) => (
                      <div key={`${r.company}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          {companyUrl(r.domain) ? (
                            <a
                              href={companyUrl(r.domain)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-[#111827] hover:text-[#701CC0] hover:underline"
                            >
                              {r.company}
                              <FiExternalLink className="h-3 w-3 shrink-0 text-[#9CA3AF]" />
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-[#111827]">{r.company}</p>
                          )}
                          <p className="mt-0.5 text-xs text-[#6B7280]">{r.description || "—"}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-right">
                          <div>
                            <p className="text-sm text-[#111827]">{r.contactName || "—"}</p>
                            <p className="text-xs text-[#6B7280]">{r.title || "—"}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#701CC0]">
                            {r.industry || "—"}
                          </span>
                          <span className="text-xs text-[#9CA3AF]">
                            {r.location || "—"}
                            {r.distanceMiles !== null ? ` · ${Math.round(r.distanceMiles)} mi` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : mode === "agentic" && agentLoading ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
              <p className="text-sm font-medium text-[#374151]">
                {agentStage && agentStage !== "done" ? `${agentStage}…` : "Starting…"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                Searching for real companies matching &ldquo;{submittedQuery}&rdquo;. This usually
                takes 10–40 seconds.
              </p>
            </div>
          ) : mode === "agentic" && agentError ? (
            <div className="mt-8 rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
              <p className="text-sm font-medium text-red-700">Agent request failed</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-red-600">{agentError}</p>
            </div>
          ) : mode === "agentic" && agentResult ? (
            (() => {
              const result = agentResult;
              const results = result.results ?? [];
              const searchErrors = result.stats?.search_errors ?? [];
              const defaultedFromSeeker = result.spec?.defaulted_from_seeker ?? [];
              const rejectedSuppression = result.stats?.rejected_suppression ?? 0;
              const rejectedCompany = result.stats?.rejected_company ?? 0;

              return (
                <div className="mt-6">
                  {result.status === "failed" ? (
                    <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
                      <p className="text-sm font-medium text-red-700">The search failed</p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-red-600">{result.error || "Unknown error."}</p>
                    </div>
                  ) : (
                    <>
                      {/* spec.summary is Artemis's interpretation of the query, not the query
                          itself — a misreading here is invisible in the results below, so it's
                          shown up front rather than only on request. */}
                      {result.spec?.summary ? (
                        <div className="mb-4 rounded-xl border border-[#ECEAF1] bg-[#FAFAFB] px-4 py-3">
                          <p className="text-sm text-[#374151]">{result.spec.summary}</p>
                          {defaultedFromSeeker.length > 0 ? (
                            <p className="mt-1 text-xs text-[#9CA3AF]">
                              Filled in from your profile, not stated in the query: {defaultedFromSeeker.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                          {results.length} {results.length === 1 ? "company" : "companies"} for &ldquo;
                          {submittedQuery}&rdquo;
                        </p>
                        {(rejectedSuppression > 0 || rejectedCompany > 0) && (
                          <p className="text-xs text-[#9CA3AF]">
                            {[
                              rejectedSuppression > 0 ? `${rejectedSuppression} suppressed` : null,
                              rejectedCompany > 0 ? `${rejectedCompany} rejected as own-company` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>

                      {results.length === 0 && searchErrors.length > 0 ? (
                        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-6 py-16 text-center">
                          <FiAlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-600" />
                          <p className="text-sm font-medium text-amber-800">Search unavailable</p>
                          <p className="mx-auto mt-1 max-w-sm text-sm text-amber-700">
                            {searchErrors.map((e) => e.kind).join(", ")} — this is not the same as
                            &ldquo;nothing matched.&rdquo; Try again once search is configured.
                          </p>
                        </div>
                      ) : results.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
                          <p className="text-sm font-medium text-[#374151]">No matches</p>
                          <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                            Nothing matched that description. Try a more specific target.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {results.map((c, i) => {
                            const city = c.geo?.city?.value;
                            const region = c.geo?.region?.value;
                            const contact = c.contacts?.[0];
                            const confidence = c.raw?.components?.confidence;
                            const matchRatio = c.raw?.components?.match_ratio;
                            const tier = typeof confidence === "number" ? confidenceTier(confidence) : null;
                            return (
                              <div
                                key={`${c.name.value}-${i}`}
                                className={`flex items-start justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                                  tier ? CONFIDENCE_TIER_STYLE[tier].border : "border-[#ECEAF1]"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center flex-wrap">
                                    {companyUrl(c.domain?.value ?? null) ? (
                                      <a
                                        href={companyUrl(c.domain?.value ?? null)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#111827] hover:text-[#701CC0] hover:underline"
                                      >
                                        {c.name.value}
                                        <FiExternalLink className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                                      </a>
                                    ) : (
                                      <p className="text-[15px] font-semibold text-[#111827]">{c.name.value}</p>
                                    )}
                                    <BasisTag basis={c.name.basis} />
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
                                    {c.raw?.reasons?.[0] || "—"}
                                  </p>
                                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#F1EFF6] pt-2.5 text-xs text-[#6B7280]">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="font-medium text-[#111827]">
                                        {contact?.name?.value || contact?.title?.value || "No contact"}
                                      </span>
                                      {contact?.name?.value && contact?.title?.value ? (
                                        <span>· {contact.title.value}</span>
                                      ) : null}
                                    </span>
                                    <span>{[city, region].filter(Boolean).join(", ") || "—"}</span>
                                  </div>
                                </div>
                                <ConfidenceBadge confidence={confidence} matchRatio={matchRatio} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
              <p className="text-sm font-medium text-[#374151]">No results yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                {mode === "search"
                  ? "Search the pool by company, industry, contact or title — or pick a center city and radius."
                  : "Describe a target and run the agent to find real companies backed by a source URL."}
              </p>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartographySection;
