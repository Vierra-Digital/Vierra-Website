import { useCallback, useEffect, useState } from "react";
import { inter } from "@/lib/fonts";
import ArtemisGenerateWidget from "@/components/artemis/ArtemisGenerateWidget";
import { panelFetch } from "@/lib/panelFetch";

type Tab = "generate" | "review";

interface ReviewItem {
  id: string;
  brain_id: string;
  kind: string;
  title: string | null;
  content: string;
  edited_content: string | null;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Status {
  online: boolean;
  message: string | null;
  model: string | null;
  usage: { windowHours: number; ok: number; errors: number; avgLatencyMs: number | null } | null;
}

const STATUS_FILTERS = ["pending", "approved", "rejected", "edited"] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#FEF3C7] text-[#92400E]",
  approved: "bg-[#DCFCE7] text-[#166534]",
  rejected: "bg-[#FEE2E2] text-[#991B1B]",
  edited: "bg-[#E0E7FF] text-[#3730A3]",
};

/**
 * Artemis control plane. The box does the generating; this is where a person decides whether any
 * of it is fit to use. Nothing is published from here — approval only marks a draft as approved.
 */
const ArtemisSection = () => {
  const [tab, setTab] = useState<Tab>("generate");
  const [status, setStatus] = useState<Status | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await panelFetch("/api/ai/status");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        // A non-2xx here is the panel refusing us (401/403), not the box being down — read the
        // reason off the response rather than trusting an error body to have the right shape.
        setStatus(
          res.ok
            ? data
            : { online: false, message: data?.message || `Panel returned ${res.status}.`, model: null, usage: null }
        );
      } catch {
        if (!cancelled) {
          setStatus({ online: false, message: "Could not reach the panel API.", model: null, usage: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The queue loads from the clicks that change what it should show — opening the tab, picking a
  // filter, acting on a draft — rather than from an effect watching that state. An effect would
  // set `loading` synchronously on every render that touched either value and cascade re-renders.
  const loadQueue = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await panelFetch(`/api/ai/review?status=${encodeURIComponent(status)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `Could not load the queue (${res.status}).`);
        return;
      }
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch {
      setError("Could not reach the panel API.");
    } finally {
      setLoading(false);
    }
  }, []);

  function openTab(next: Tab) {
    setTab(next);
    if (next === "review") void loadQueue(filter);
  }

  function changeFilter(next: string) {
    setFilter(next);
    void loadQueue(next);
  }

  async function act(id: string, action: "approve" | "reject") {
    setActingOn(id);
    setError(null);
    try {
      const res = await fetch(`/api/ai/review/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `Could not ${action} that draft (${res.status}).`);
        return;
      }
      await loadQueue(filter);
    } catch {
      setError("Could not reach the panel API.");
    } finally {
      setActingOn(null);
    }
  }

  const pending = counts.pending ?? 0;

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1680px] flex flex-col">
          <div className="w-full flex flex-wrap justify-between items-center gap-3 mt-6 mb-6">
            <h1 className="text-2xl font-semibold text-[#111827]">Artemis</h1>
            {status && (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <span
                  aria-hidden="true"
                  className={`inline-block w-2 h-2 rounded-full ${status.online ? "bg-[#16A34A]" : "bg-[#DC2626]"}`}
                />
                <span>
                  {status.online ? status.model || "online" : status.message || "offline"}
                  {status.usage && status.online
                    ? ` · ${status.usage.ok} runs / ${status.usage.windowHours}h${
                        status.usage.avgLatencyMs ? ` · ${status.usage.avgLatencyMs}ms avg` : ""
                      }${status.usage.errors ? ` · ${status.usage.errors} failed` : ""}`
                    : ""}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
            {(
              [
                ["generate", "Generate"],
                ["review", pending ? `Review queue (${pending})` : "Review queue"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => openTab(value)}
                className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
                  tab === value
                    ? "border-[#701CC0] text-[#701CC0]"
                    : "border-transparent text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mb-5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-sm text-[#991B1B]">
              {error}
            </p>
          )}

          {tab === "generate" && (
            <div className="max-w-3xl pb-10">
              <ArtemisGenerateWidget onGenerated={() => setCounts((c) => ({ ...c, pending: (c.pending ?? 0) + 1 }))} />
            </div>
          )}

          {tab === "review" && (
            <div className="pb-10">
              <div className="flex flex-wrap gap-2 mb-5">
                {STATUS_FILTERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeFilter(value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                      filter === value
                        ? "bg-[#701CC0] text-white"
                        : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                    }`}
                  >
                    {value}
                    {counts[value] ? ` (${counts[value]})` : ""}
                  </button>
                ))}
              </div>

              {loading && <p className="text-sm text-[#6B7280]">Loading…</p>}

              {!loading && !error && items.length === 0 && (
                <p className="text-sm text-[#6B7280]">Nothing {filter} right now.</p>
              )}

              <div className="flex flex-col gap-4">
                {items.map((item) => (
                  <article key={item.id} className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#111827] truncate">
                          {item.title || "Untitled draft"}
                        </h3>
                        <p className="text-xs text-[#6B7280] mt-0.5">
                          {item.kind} · {item.brain_id} · {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          STATUS_STYLES[item.status] || "bg-[#F3F4F6] text-[#374151]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <pre className="whitespace-pre-wrap break-words rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-sm text-[#111827] max-h-80 overflow-y-auto">
                      {item.edited_content || item.content}
                    </pre>

                    {item.status === "pending" && (
                      <div className="flex gap-2 mt-4">
                        <button
                          type="button"
                          disabled={actingOn === item.id}
                          onClick={() => act(item.id, "approve")}
                          className="rounded-lg bg-[#701CC0] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5d17a0] disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actingOn === item.id}
                          onClick={() => act(item.id, "reject")}
                          className="rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6] disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtemisSection;
