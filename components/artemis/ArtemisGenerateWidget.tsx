import { useState } from "react";
import { inter } from "@/lib/fonts";
import { panelFetch } from "@/lib/panelFetch";

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
] as const;

const BRAINS = [
  { value: "vierra", label: "Vierra" },
  { value: "ndimensions", label: "NDimensions" },
] as const;

interface Props {
  /** Fires after a successful run so a parent (the review queue) can refresh. */
  onGenerated?: (reviewItemId: string | null) => void;
  /** Pre-set the platform when embedded somewhere with an obvious answer, like the blog editor. */
  defaultPlatform?: (typeof PLATFORMS)[number]["value"];
  /** Keep the result on screen only; nothing is written to the review queue. */
  saveToReview?: boolean;
}

/**
 * Asks the Artemis box for brand-voice drafts. The box does the retrieval — this only collects a
 * topic and shows what came back. Drafts are drafts: nothing here posts or sends.
 */
export default function ArtemisGenerateWidget({ onGenerated, defaultPlatform, saveToReview = true }: Props) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<string>(defaultPlatform ?? "linkedin");
  const [brain, setBrain] = useState<string>("vierra");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<string | null>(null);
  const [usedContext, setUsedContext] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDrafts(null);
    setCopied(false);
    try {
      const res = await panelFetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, platform, brain, saveToReview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `Generation failed (${res.status}).`);
        return;
      }
      setDrafts(data.drafts || "");
      setUsedContext(Boolean(data.usedContext));
      onGenerated?.(data.reviewItemId ?? null);
    } catch {
      setError("Could not reach the panel API.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!drafts) return;
    try {
      await navigator.clipboard.writeText(drafts);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard is blocked in this browser.");
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 ${inter.className}`}>
      <h2 className="text-lg font-semibold text-[#111827] mb-1">Generate drafts</h2>
      <p className="text-sm text-[#6B7280] mb-5">
        Grounded in the brand voice and knowledge base for the selected brain.
        {saveToReview ? " Results land in the review queue." : ""}
      </p>

      <label className="block text-sm font-medium text-[#374151] mb-2" htmlFor="artemis-topic">
        Topic
      </label>
      <textarea
        id="artemis-topic"
        rows={3}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="What should Artemis write about?"
        className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors resize-y"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-2" htmlFor="artemis-platform">
            Platform
          </label>
          <select
            id="artemis-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-2" htmlFor="artemis-brain">
            Brain
          </label>
          <select
            id="artemis-brain"
            value={brain}
            onChange={(e) => setBrain(e.target.value)}
            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none"
          >
            {BRAINS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          type="button"
          onClick={generate}
          disabled={busy || !topic.trim()}
          className="rounded-lg bg-[#701CC0] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5d17a0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {busy && <span className="text-sm text-[#6B7280]">The box takes a few seconds to think.</span>}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </p>
      )}

      {drafts !== null && !error && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#374151]">
              Drafts{usedContext ? " · used knowledge base" : " · no knowledge base match"}
            </span>
            <button
              type="button"
              onClick={copy}
              className="text-sm font-medium text-[#701CC0] hover:underline"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-sm text-[#111827]">
            {drafts || "The model returned nothing."}
          </pre>
        </div>
      )}
    </div>
  );
}
