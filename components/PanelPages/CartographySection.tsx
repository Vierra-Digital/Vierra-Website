import React, { useEffect, useState } from "react";
import { FiSearch, FiZap, FiInbox, FiExternalLink } from "react-icons/fi";
import type { CartographyAgentCandidate, SubAgentTaskResult } from "@/pages/api/cartography/agent";
import type { CartographySearchResult } from "@/pages/api/cartography/search";
import type { CartographyLocation } from "@/pages/api/cartography/locations";
import ReviewQueue from "@/components/PanelPages/CartographySection/ReviewQueue";
import { companyUrl } from "@/lib/cartography/companyUrl";

type CartographyScreen = "discover" | "review";
type CartographyMode = "search" | "agentic";

const MODE_COPY: Record<CartographyMode, { placeholder: string; hint: string }> = {
  search: {
    placeholder: "Search companies, contacts or industries…",
    hint: "Looks up the existing Cartography pool by keyword — company name, industry, title.",
  },
  agentic: {
    placeholder: 'Describe who you’re looking for — e.g. "ecom brands under 50 employees that just signed with Stripe"',
    hint: "Hands the description to an agent, which researches and compiles a new candidate list.",
  },
};

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
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentCandidates, setAgentCandidates] = useState<CartographyAgentCandidate[] | null>(null);
  const [agentTasks, setAgentTasks] = useState<SubAgentTaskResult[]>([]);

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
    setAgentError(null);
    setAgentCandidates(null);
    setAgentTasks([]);
    try {
      const res = await fetch("/api/cartography/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAgentError(data?.message || "The agent request failed.");
        return;
      }
      setAgentCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
      setAgentTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      const attemptedTasks = Array.isArray(data?.tasks)
        ? (data.tasks as SubAgentTaskResult[]).filter((task) => task.status !== "not_implemented")
        : [];
      if (attemptedTasks.length > 0 && attemptedTasks.every((task) => task.status === "failed")) {
        setAgentError(attemptedTasks.map((task) => task.status === "failed" ? task.error : "").join(" "));
      }
    } catch {
      setAgentError("Couldn't reach the agent endpoint.");
    } finally {
      setAgentLoading(false);
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
    setAgentLoading(false);
    setAgentError(null);
    setAgentCandidates(null);
    setAgentTasks([]);
  };

  const SUB_AGENT_LABELS: Record<SubAgentTaskResult["method"], string> = {
    general: "General web",
    google_business: "Google Business",
    linkedin_sales_nav: "LinkedIn Sales Nav",
  };

  const subAgentSummary = (task: SubAgentTaskResult) => {
    if (task.status === "completed") return `${task.candidateCount} found`;
    if (task.status === "not_implemented") return "not built yet";
    return "failed";
  };

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
              <p className="text-sm font-medium text-[#374151]">Running sub-agents…</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                Matching &ldquo;{submittedQuery}&rdquo; against General web, Google Business, and
                LinkedIn Sales Nav in parallel.
              </p>
            </div>
          ) : mode === "agentic" && agentError ? (
            <div className="mt-8 rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
              <p className="text-sm font-medium text-red-700">Agent request failed</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-red-600">{agentError}</p>
            </div>
          ) : mode === "agentic" && agentCandidates ? (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                  {agentCandidates.length} {agentCandidates.length === 1 ? "candidate" : "candidates"} for &ldquo;
                  {submittedQuery}&rdquo;
                </p>
                <p className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  AI-suggested — unverified, not real leads
                </p>
              </div>
              {agentTasks.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {agentTasks.map((task) => (
                    <span
                      key={task.method}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        task.status === "completed"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : task.status === "failed"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]"
                      }`}
                      title={task.status === "failed" ? task.error : undefined}
                    >
                      {SUB_AGENT_LABELS[task.method]}: {subAgentSummary(task)}
                    </span>
                  ))}
                </div>
              ) : null}
              {agentCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
                  <p className="text-sm font-medium text-[#374151]">No candidates</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                    The agent didn&rsquo;t return any candidates for that description. Try a more
                    specific ICP.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#ECEAF1] bg-white">
                  <div className="divide-y divide-[#F1EFF6]">
                    {agentCandidates.map((c, i) => (
                      <div key={`${c.company}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          {companyUrl(c.domain) ? (
                            <a
                              href={companyUrl(c.domain)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-medium text-[#111827] hover:text-[#701CC0] hover:underline"
                            >
                              {c.company}
                              <FiExternalLink className="h-3 w-3 shrink-0 text-[#9CA3AF]" />
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-[#111827]">{c.company}</p>
                          )}
                          <p className="mt-0.5 text-xs text-[#6B7280]">{c.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-right">
                          <div>
                            <p className="text-xs text-[#9CA3AF]">Target role</p>
                            <p className="text-sm text-[#111827]">{c.suggestedTitle || "—"}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#701CC0]">
                            {c.industry || "—"}
                          </span>
                          <span className="text-xs text-[#9CA3AF]">
                            {c.location || "—"} · via {SUB_AGENT_LABELS[c.sourceMethod]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
              <p className="text-sm font-medium text-[#374151]">No results yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                {mode === "search"
                  ? "Search the pool by company, industry, contact or title — or pick a center city and radius."
                  : "Describe a target and run the agent to get AI-suggested candidate companies."}
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
