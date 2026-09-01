import React, { useEffect, useState } from "react";
import { FiCheck, FiX, FiRefreshCw } from "react-icons/fi";
import type { CartographyReviewRow } from "@/pages/api/cartography/contacts";
import type { PromoteResult } from "@/pages/api/cartography/contacts/promote";

/**
 * Cartography's review queue (see docs/CARTOGRAPHY_DESIGN.md Rollout M4) — the screen that
 * turns a sourced candidate into a real Contact. Everything Search/Agentic mode finds lands
 * here first (status: 'candidate') and goes nowhere until a staff member fills in whatever
 * Artemis never fabricates (a real name/email), rejects the junk, and promotes the rest.
 */
const ReviewQueue: React.FC = () => {
  const [rows, setRows] = useState<CartographyReviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Partial<Pick<CartographyReviewRow, "name" | "email" | "title">>>>({});
  const [promoting, setPromoting] = useState(false);
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cartography/contacts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to load the review queue.");
        return;
      }
      setRows(Array.isArray(data?.results) ? data.results : []);
      setSelected(new Set());
      setEdits({});
      setRowMessages({});
    } catch {
      setError("Couldn't reach the review queue endpoint.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this — `load()` sets several pieces of state
    // (loading/error/rows/selected/edits/rowMessages), unlike the single-setter fetch-on-mount
    // pattern elsewhere in this codebase (e.g. CampaignsSection.tsx's loadCampaigns) that the
    // rule doesn't flag. Fetch-on-mount is still the right pattern here; deferring the load to
    // avoid this warning would only add an artificial delay before the first fetch starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const fieldValue = (row: CartographyReviewRow, field: "name" | "email" | "title"): string =>
    edits[row.id]?.[field] ?? row[field] ?? "";

  const setField = (id: string, field: "name" | "email" | "title", value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveField = async (row: CartographyReviewRow, field: "name" | "email" | "title") => {
    const value = fieldValue(row, field);
    if (value === (row[field] || "")) return; // unchanged — nothing to save
    try {
      const res = await fetch(`/api/cartography/contacts/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowMessages((prev) => ({ ...prev, [row.id]: data?.message || "Save failed." }));
        return;
      }
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)) : prev));
    } catch {
      setRowMessages((prev) => ({ ...prev, [row.id]: "Couldn't reach the Cartography store." }));
    }
  };

  const reject = async (row: CartographyReviewRow) => {
    try {
      const res = await fetch(`/api/cartography/contacts/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRowMessages((prev) => ({ ...prev, [row.id]: data?.message || "Reject failed." }));
        return;
      }
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    } catch {
      setRowMessages((prev) => ({ ...prev, [row.id]: "Couldn't reach the Cartography store." }));
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Takes explicit ids rather than always reading `selected` — the single-row "promote this
  // one" button needs to promote an id that may not be (and doesn't need to become) part of
  // the bulk selection, and setSelected()-then-read-selected in the same handler would race
  // React's state batching anyway.
  const promoteIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    setPromoting(true);
    try {
      const res = await fetch("/api/cartography/contacts/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Promotion request failed.");
        return;
      }
      const results: PromoteResult[] = Array.isArray(data?.results) ? data.results : [];
      const succeededIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const messages: Record<string, string> = {};
      for (const r of results) if (!r.ok && r.reason) messages[r.id] = r.reason;
      setRowMessages((prev) => ({ ...prev, ...messages }));
      setRows((prev) => (prev ? prev.filter((r) => !succeededIds.has(r.id)) : prev));
      setSelected((prev) => {
        const next = new Set(prev);
        succeededIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch {
      setError("Couldn't reach the promote endpoint.");
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#374151]">Loading the review queue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
        <p className="text-sm font-medium text-red-700">Couldn&rsquo;t load the review queue</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          <FiRefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const results = rows || [];

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          {results.length} awaiting review{selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F9FAFB]"
          >
            <FiRefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => promoteIds(Array.from(selected))}
            disabled={selected.size === 0 || promoting}
            className="inline-flex items-center gap-2 rounded-md bg-[#701CC0] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {promoting ? "Promoting…" : `Import ${selected.size || ""} to Contacts`}
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#374151]">Nothing to review</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
            Candidates sourced from Search or Agentic mode land here — nothing&rsquo;s waiting
            right now.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAF1] bg-white">
          <div className="divide-y divide-[#F1EFF6]">
            {results.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#701CC0]"
                    aria-label={`Select ${row.company}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[#111827]">{row.company}</p>
                      {row.industry ? (
                        <span className="inline-flex items-center rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#701CC0]">
                          {row.industry}
                        </span>
                      ) : null}
                      <span className="text-xs text-[#9CA3AF]">
                        {row.location || "—"} · via {row.sourceMethod}
                      </span>
                    </div>
                    {row.description ? <p className="mt-0.5 text-xs text-[#6B7280]">{row.description}</p> : null}

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        value={fieldValue(row, "name")}
                        onChange={(e) => setField(row.id, "name", e.target.value)}
                        onBlur={() => saveField(row, "name")}
                        placeholder="Contact name"
                        aria-label={`Contact name for ${row.company}`}
                        className="rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0]/25"
                      />
                      <input
                        value={fieldValue(row, "email")}
                        onChange={(e) => setField(row.id, "email", e.target.value)}
                        onBlur={() => saveField(row, "email")}
                        placeholder="Email (required to promote)"
                        aria-label={`Email for ${row.company}`}
                        className="rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0]/25"
                      />
                      <input
                        value={fieldValue(row, "title")}
                        onChange={(e) => setField(row.id, "title", e.target.value)}
                        onBlur={() => saveField(row, "title")}
                        placeholder="Title"
                        aria-label={`Title for ${row.company}`}
                        className="rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0]/25"
                      />
                    </div>
                    {rowMessages[row.id] ? (
                      <p className="mt-1.5 text-xs text-red-600">{rowMessages[row.id]}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => reject(row)}
                      title="Reject"
                      aria-label={`Reject ${row.company}`}
                      className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-red-50 hover:text-red-600"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => promoteIds([row.id])}
                      title="Promote this one"
                      aria-label={`Promote ${row.company}`}
                      className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-green-50 hover:text-green-600"
                    >
                      <FiCheck className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewQueue;
