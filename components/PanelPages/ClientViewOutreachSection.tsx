import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Inter } from "next/font/google";
import PanelSectionHeader from "@/components/ui/PanelSectionHeader";
import { FiGlobe, FiHeart, FiMail, FiMessageCircle, FiMoreHorizontal, FiRepeat, FiSend, FiThumbsUp } from "react-icons/fi";

const inter = Inter({ subsets: ["latin"] });

type Step = "cards" | "account" | "company" | "context" | "manual" | "research" | "result";
type Mode = "manual" | "market_research";
type TargetType = "personal" | "company";

type LinkedInContext = {
  client: { id: string; name: string; businessName: string };
  onboarding: {
    website: string;
    industry: string;
    targetAudience: string;
    socialMediaGoals: string;
    brandTone: string;
    businessSummary: string;
  };
  overrides: {
    additionalBusinessInfo: string;
    postTopic: string;
    keywords: string;
    notes: string;
  };
  assets: Array<{ id: string; name: string; fileType: string }>;
};

const AnimatedLinkedInIcon: React.FC = () => (
  <svg viewBox="0 0 96 96" className="w-12 h-12 text-[#701CC0]" fill="none" aria-hidden="true">
    <circle cx="48" cy="48" r="31" stroke="currentColor" strokeWidth="2.2" opacity="0.16">
      <animate attributeName="r" values="27;33;27" dur="1.9s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.08;0.2;0.08" dur="1.9s" repeatCount="indefinite" />
    </circle>
    <circle cx="48" cy="48" r="24" stroke="currentColor" strokeWidth="2" opacity="0.22">
      <animate attributeName="r" values="22;25.5;22" dur="1.25s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.12;0.3;0.12" dur="1.25s" repeatCount="indefinite" />
    </circle>
    <g>
      <rect x="29" y="27" width="38" height="38" rx="8" fill="currentColor" />
      <circle cx="38.5" cy="38.5" r="3.1" fill="white" />
      <rect x="35.7" y="44.3" width="5.6" height="14.5" rx="1.8" fill="white" />
      <path
        d="M46 58.8V44.3h5.8v2.4c1.2-1.8 3.2-3 5.8-3c5.1 0 7.4 3.2 7.4 8.1v7h-5.8v-6c0-2.5-.9-3.8-2.9-3.8c-1.6 0-2.5 1-2.9 2.1c-.2.5-.2 1-.2 1.6v6.1z"
        fill="white"
      />
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.2;0 0" dur="1.15s" repeatCount="indefinite" />
    </g>
    <path d="M22 66c7 6.3 14.8 9.5 26 9.5s19-3.2 26-9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.45">
      <animate attributeName="opacity" values="0.15;0.55;0.15" dur="1.4s" repeatCount="indefinite" />
    </path>
  </svg>
);

const AnimatedEmailScraperIcon: React.FC = () => (
  <svg viewBox="0 0 96 96" className="w-12 h-12 text-[#701CC0]" fill="none" aria-hidden="true">
    <rect x="18" y="26" width="60" height="40" rx="9" stroke="currentColor" strokeWidth="2.4" opacity="0.9" />
    <path d="M22 32l26 18l26-18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <animate attributeName="opacity" values="0.45;1;0.45" dur="1.05s" repeatCount="indefinite" />
    </path>
    <path d="M22 61l16-13M74 61L58 48" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    <g>
      <circle cx="69" cy="27" r="6" fill="currentColor" opacity="0.95" />
      <path d="M69 24.4v5.2M66.4 27h5.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <animateTransform attributeName="transform" type="scale" values="1;1.12;1" dur="0.95s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.7;1;0.7" dur="0.95s" repeatCount="indefinite" />
    </g>
    <g>
      <path d="M31 74l17-6l-6 17l-3-7z" fill="currentColor" />
      <animateTransform attributeName="transform" type="translate" values="0 0;2.4 -1.4;0 0" dur="1.2s" repeatCount="indefinite" />
    </g>
    <circle cx="31" cy="74" r="2" fill="currentColor" opacity="0.25">
      <animate attributeName="r" values="1.4;3.8;1.4" dur="1.2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.25;0;0.25" dur="1.2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const AnimatedEmailingPlatformIcon: React.FC = () => (
  <svg viewBox="0 0 96 96" className="w-12 h-12 text-[#701CC0]" fill="none" aria-hidden="true">
    <rect x="14" y="20" width="68" height="48" rx="10" stroke="currentColor" strokeWidth="2.4" opacity="0.9" />
    <path d="M20 28l28 20l28-20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <animate attributeName="opacity" values="0.35;1;0.35" dur="1.1s" repeatCount="indefinite" />
    </path>
    <path d="M20 62l18-15M76 62L58 47" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
    <circle cx="72" cy="24" r="3.8" fill="currentColor">
      <animate attributeName="r" values="3;4.8;3" dur="0.95s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;1;0.6" dur="0.95s" repeatCount="indefinite" />
    </circle>
    <path d="M28 76h40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.35">
      <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
    </path>
  </svg>
);

const textInputClass =
  "mt-1 w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]";

const ClientViewOutreachSection: React.FC<{ clientId?: string | null }> = ({ clientId }) => {
  const [step, setStep] = useState<Step>("cards");
  const [targetType, setTargetType] = useState<TargetType>("personal");
  const [companyPages, setCompanyPages] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [context, setContext] = useState<LinkedInContext | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [needsCompanyReconnect, setNeedsCompanyReconnect] = useState(false);

  const [formState, setFormState] = useState({
    additionalBusinessInfo: "",
    postTopic: "",
    keywords: "",
    notes: "",
    extraContext: "",
  });

  const [mode, setMode] = useState<Mode>("manual");
  const [result, setResult] = useState<{
    draft: {
      hook: string;
      body: string;
      cta: string;
      hashtags: string[];
      suggestedKeyword: string;
      evidence: string[];
      recommendations: Array<{
        title: string;
        rationale: string;
        sampleCopy: string;
        projectedEngagementRate?: string;
      }>;
    };
    metrics?: {
      attempts: number;
      meetings: number;
      clientsClosed: number;
      revenue: number;
      engagementRateProxy: number;
    };
    benchmarkAngles?: Array<{ keyword: string; title: string; angle: string }>;
    enrichedKeywords?: string[];
  } | null>(null);

  const fullPostText = useMemo(() => {
    if (!result) return "";
    const hashtags = result.draft.hashtags?.length ? `\n\n${result.draft.hashtags.join(" ")}` : "";
    return `${result.draft.hook}\n\n${result.draft.body}\n\n${result.draft.cta}${hashtags}`.trim();
  }, [result]);
  const previewLines = useMemo(
    () => fullPostText.split("\n").map((line) => line.trimEnd()),
    [fullPostText]
  );

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/context/client${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load context");
      setContext(payload);
      const editable = payload.editableAnswers || {};
      setFormState((prev) => ({
        ...prev,
        additionalBusinessInfo:
          payload.overrides?.additionalBusinessInfo ||
          editable.additionalInfo ||
          editable.productService ||
          editable.valueProposition ||
          "",
        postTopic: payload.overrides?.postTopic || editable.socialMediaGoals || "",
        keywords: payload.overrides?.keywords || "",
        notes: payload.overrides?.notes || editable.avoidMentions || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (step === "context") {
      fetchContext();
    }
  }, [step, fetchContext]);

  const loadCompanyPages = async () => {
    setLoading(true);
    setError("");
    setNeedsCompanyReconnect(false);
    setSelectedCompanyId("");
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/linkedin/company-pages${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to load company pages");
      if (!payload.connected) {
        setNeedsCompanyReconnect(true);
        throw new Error(payload.message || "LinkedIn is not connected for this account.");
      }
      const pages = Array.isArray(payload.pages) ? payload.pages : [];
      setCompanyPages(pages);
      if (pages.length === 0) setNeedsCompanyReconnect(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company pages");
    } finally {
      setLoading(false);
    }
  };

  const saveContext = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/context/client${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalBusinessInfo: formState.additionalBusinessInfo,
          postTopic: formState.postTopic,
          keywords: formState.keywords,
          notes: formState.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to save context");
      setSuccess("Context saved.");
      setTimeout(() => setSuccess(""), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save context");
    } finally {
      setLoading(false);
    }
  };

  const generate = async (requestedMode: Mode, revisionInstructions?: string) => {
    setMode(requestedMode);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/linkedin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          mode: requestedMode,
          extraContext: formState.extraContext,
          postTopic: formState.postTopic,
          keywords: formState.keywords,
          selectedAssetIds,
          revisionInstructions,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Generation failed");
      setResult(payload);
      setFormState((prev) => ({ ...prev, extraContext: "" }));
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const publishNow = async () => {
    if (!result) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          targetType,
          companyId: targetType === "company" ? selectedCompanyId : undefined,
          postText: fullPostText,
          visibility: "PUBLIC",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Post failed");
      setSuccess("Posted to LinkedIn.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setLoading(false);
    }
  };

  const schedulePost = async () => {
    if (!result || !scheduleAt) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/linkedin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          targetType,
          companyId: targetType === "company" ? selectedCompanyId : undefined,
          postText: fullPostText,
          scheduledFor: new Date(scheduleAt).toISOString(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Schedule failed");
      setSuccess(`Post scheduled for ${new Date(payload.scheduled.scheduledFor).toLocaleString()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="w-full max-w-6xl flex flex-col h-full pb-8">
          <PanelSectionHeader
            title={
              step === "cards"
                ? "Outreach"
                : step === "context"
                ? "LinkedIn Post Context"
                : step === "account" || step === "company"
                ? "LinkedIn Post"
                : step === "research"
                ? "Market Research"
                : step === "manual"
                ? "Manual Draft Builder"
                : "LinkedIn Post Preview"
            }
          />

          {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

          {step === "cards" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <button
                type="button"
                onClick={() => setStep("account")}
                className="text-left rounded-xl border border-[#E5E7EB] bg-white shadow-sm p-5 hover:border-[#C4B5FD] hover:shadow-md transition"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <AnimatedLinkedInIcon />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#111827]">LinkedIn Posting</h3>
                    <p className="text-sm text-[#6B7280] mt-1">
                      Choose personal/company targeting, build context, run manual or market-research generation, then post now or schedule.
                    </p>
                  </div>
                </div>
              </button>

              <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm p-5 opacity-80">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <AnimatedEmailScraperIcon />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#111827]">LinkedIn Sales Navigator Email Scraper</h3>
                    <p className="text-sm text-[#6B7280] mt-1">Coming next in the outreach roadmap.</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.open("/panel/email", "_blank", "noopener,noreferrer")}
                className="text-left rounded-xl border border-[#E5E7EB] bg-white shadow-sm p-5 hover:border-[#C4B5FD] hover:shadow-md transition"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <AnimatedEmailingPlatformIcon />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#111827] flex items-center gap-2">
                      <FiMail className="w-4 h-4 text-[#701CC0]" />
                      Email Panel
                    </h3>
                    <p className="text-sm text-[#6B7280] mt-1">
                      Open full-screen email panel in a dedicated tab.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {step === "account" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => {
                  setTargetType("personal");
                  setStep("context");
                }}
                className="rounded-xl border border-[#E5E7EB] p-6 text-left hover:border-[#C4B5FD] hover:shadow-sm transition"
              >
                <h3 className="text-lg font-semibold text-[#111827]">Personal LinkedIn Account</h3>
                <p className="text-sm text-[#6B7280] mt-2">Post as your own profile.</p>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setTargetType("company");
                  setStep("company");
                  await loadCompanyPages();
                }}
                className="rounded-xl border border-[#E5E7EB] p-6 text-left hover:border-[#C4B5FD] hover:shadow-sm transition"
              >
                <h3 className="text-lg font-semibold text-[#111827]">Company LinkedIn Account</h3>
                <p className="text-sm text-[#6B7280] mt-2">Post as a company page.</p>
              </button>
            </div>
          )}

          {step === "company" && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-[#111827]">Select Company Page</h3>
              {loading ? (
                <div className="py-8 text-sm text-[#6B7280]">Loading company pages...</div>
              ) : companyPages.length === 0 ? (
                <p className="mt-3 text-sm text-[#6B7280]">No pages found. Ensure LinkedIn company permissions are connected.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {companyPages.map((page) => (
                    <label key={page.id} className="flex items-center gap-3 rounded-md border border-[#E5E7EB] px-3 py-2">
                      <input
                        type="radio"
                        name="company-page"
                        value={page.id}
                        checked={selectedCompanyId === page.id}
                        onChange={() => setSelectedCompanyId(page.id)}
                      />
                      <span className="text-sm text-[#111827]">{page.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={!selectedCompanyId}
                  onClick={() => setStep("context")}
                  className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm font-medium hover:bg-[#5d17a0] disabled:opacity-50"
                >
                  Continue
                </button>
                <button type="button" onClick={() => setStep("account")} className="rounded-lg border px-4 py-2 text-sm">
                  Back
                </button>
                {(needsCompanyReconnect || companyPages.length === 0) ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.open("/api/linkedin/initiate?mode=company", "_blank", "noopener,noreferrer");
                    }}
                    className="rounded-lg border border-[#701CC0] text-[#701CC0] px-4 py-2 text-sm font-medium hover:bg-[#F3E8FF]"
                  >
                    Reconnect LinkedIn (Company Scopes)
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {step === "context" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827]">Onboarding + Business Context</h3>
                {loading ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto" />
                      <p className="mt-2 text-sm text-[#6B7280]">Loading Context Data...</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#374151]">
                    <p><span className="font-medium text-[#111827]">Business:</span> {context?.client.businessName || "N/A"}</p>
                    <p><span className="font-medium text-[#111827]">Website:</span> {context?.onboarding.website || "N/A"}</p>
                    <p><span className="font-medium text-[#111827]">Industry:</span> {context?.onboarding.industry || "N/A"}</p>
                    <p><span className="font-medium text-[#111827]">Audience:</span> {context?.onboarding.targetAudience || "N/A"}</p>
                    <p><span className="font-medium text-[#111827]">Goals:</span> {context?.onboarding.socialMediaGoals || "N/A"}</p>
                    <p><span className="font-medium text-[#111827]">Tone:</span> {context?.onboarding.brandTone || "N/A"}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827]">Editable LinkedIn Context</h3>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-sm text-[#374151]">
                    Additional Business Info
                    <textarea
                      rows={3}
                      value={formState.additionalBusinessInfo}
                      onChange={(e) => setFormState((prev) => ({ ...prev, additionalBusinessInfo: e.target.value }))}
                      className={textInputClass}
                    />
                  </label>
                  <label className="text-sm text-[#374151]">
                    Post Topic Intent
                    <textarea
                      rows={3}
                      value={formState.postTopic}
                      onChange={(e) => setFormState((prev) => ({ ...prev, postTopic: e.target.value }))}
                      className={textInputClass}
                    />
                  </label>
                  <label className="text-sm text-[#374151]">
                    Keywords
                    <input
                      value={formState.keywords}
                      onChange={(e) => setFormState((prev) => ({ ...prev, keywords: e.target.value }))}
                      className={textInputClass}
                    />
                  </label>
                  <label className="text-sm text-[#374151]">
                    Additional Notes
                    <input
                      value={formState.notes}
                      onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                      className={textInputClass}
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-[#111827]">Select image assets for post context</p>
                  <div className="mt-2 max-h-40 overflow-auto space-y-2">
                    {(context?.assets || []).map((asset) => (
                      <label key={asset.id} className="flex items-center gap-3 border rounded-md px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={(e) =>
                            setSelectedAssetIds((prev) =>
                              e.target.checked ? [...prev, asset.id] : prev.filter((id) => id !== asset.id)
                            )
                          }
                        />
                        <span>{asset.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={saveContext} className="rounded-lg border px-4 py-2 text-sm">
                    Save Context
                  </button>
                  <button type="button" onClick={() => setStep("manual")} className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm">
                    Manual Mode
                  </button>
                  <button type="button" onClick={() => setStep("research")} className="rounded-lg bg-[#111827] text-white px-4 py-2 text-sm">
                    Market Research Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {(step === "manual" || step === "research") && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-[#374151]">
                  Additional Context
                  <textarea
                    rows={4}
                    value={formState.extraContext}
                    onChange={(e) => setFormState((prev) => ({ ...prev, extraContext: e.target.value }))}
                    className={textInputClass}
                  />
                </label>
                <label className="text-sm text-[#374151]">
                  Post Topic
                  <textarea
                    rows={4}
                    value={formState.postTopic}
                    onChange={(e) => setFormState((prev) => ({ ...prev, postTopic: e.target.value }))}
                    className={textInputClass}
                  />
                </label>
              </div>

              {step === "research" ? (
                <p className="mt-4 text-sm text-[#6B7280]">
                  Research mode will analyze client historical performance plus benchmark angles and return ranked recommendations with evidence for impressions, likes, comments, reposts, and engagement rates.
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => generate(step === "research" ? "market_research" : "manual")}
                  className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm font-medium hover:bg-[#5d17a0] disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate"}
                </button>
                <button type="button" onClick={() => setStep("context")} className="rounded-lg border px-4 py-2 text-sm">
                  Back
                </button>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827] mb-3">LinkedIn Post Preview</h3>

                <div className="rounded-lg border border-[#D1D5DB] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E7EB] bg-white flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#701CC0] text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        {context?.client?.businessName?.slice(0, 1).toUpperCase() || "V"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {context?.client?.businessName || context?.client?.name || "Your Company"}
                        </p>
                        <p className="text-xs text-[#6B7280] truncate">Promoted with Vierra Growth System</p>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-[#6B7280]">
                          <span>Now</span>
                          <span>•</span>
                          <FiGlobe className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                    <button type="button" className="text-[#6B7280] hover:text-[#111827]">
                      <FiMoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-4 py-3 bg-white">
                    <div className="text-sm leading-6 text-[#111827] whitespace-pre-wrap">
                      {previewLines.map((line, idx) => {
                        if (!line) return <br key={`br-${idx}`} />;
                        const isHashLine = line.startsWith("#");
                        return (
                          <p key={`line-${idx}`} className={isHashLine ? "text-[#0A66C2] font-medium" : undefined}>
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-4 py-2 border-t border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between text-xs text-[#6B7280]">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0A66C2] text-white">
                        <FiThumbsUp className="w-2.5 h-2.5" />
                      </span>
                      <span>Potential engagement signal</span>
                    </div>
                    <span>Preview</span>
                  </div>

                  <div className="px-2 py-1 border-t border-[#E5E7EB] bg-white grid grid-cols-4 gap-1">
                    <button type="button" className="flex items-center justify-center gap-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-md py-2 text-xs font-medium">
                      <FiHeart className="w-3.5 h-3.5" />
                      Like
                    </button>
                    <button type="button" className="flex items-center justify-center gap-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-md py-2 text-xs font-medium">
                      <FiMessageCircle className="w-3.5 h-3.5" />
                      Comment
                    </button>
                    <button type="button" className="flex items-center justify-center gap-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-md py-2 text-xs font-medium">
                      <FiRepeat className="w-3.5 h-3.5" />
                      Repost
                    </button>
                    <button type="button" className="flex items-center justify-center gap-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-md py-2 text-xs font-medium">
                      <FiSend className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {mode === "market_research" && result.metrics ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-[#111827]">Metrics Analysis</h4>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><p className="text-[#6B7280]">Impressions Proxy</p><p className="font-semibold">{result.metrics.attempts}</p></div>
                    <div><p className="text-[#6B7280]">Likes/Comments Proxy</p><p className="font-semibold">{result.metrics.meetings}</p></div>
                    <div><p className="text-[#6B7280]">Reposts Proxy</p><p className="font-semibold">{result.metrics.clientsClosed}</p></div>
                    <div><p className="text-[#6B7280]">Revenue</p><p className="font-semibold">${result.metrics.revenue.toLocaleString()}</p></div>
                    <div><p className="text-[#6B7280]">Engagement Rate</p><p className="font-semibold">{result.metrics.engagementRateProxy}%</p></div>
                  </div>
                </div>
              ) : null}

              {result.draft.recommendations?.length ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-semibold text-[#111827]">Ranked Recommendations</h4>
                  <div className="mt-3 space-y-3">
                    {result.draft.recommendations.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-md border border-[#E5E7EB] p-3">
                        <p className="text-sm font-semibold text-[#111827]">{index + 1}. {item.title}</p>
                        <p className="text-sm text-[#374151] mt-1">{item.rationale}</p>
                        <p className="text-sm text-[#111827] mt-2 whitespace-pre-wrap">{item.sampleCopy}</p>
                        {item.projectedEngagementRate ? (
                          <p className="text-xs text-[#6B7280] mt-2">Projected Engagement: {item.projectedEngagementRate}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-[#111827]">Actions</h4>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" disabled={loading} onClick={publishNow} className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm">
                    Post Now
                  </button>
                  <button type="button" onClick={() => setShowRegenerateModal(true)} className="rounded-lg border px-4 py-2 text-sm">
                    Regenerate
                  </button>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <button type="button" disabled={loading || !scheduleAt} onClick={schedulePost} className="rounded-lg bg-[#111827] text-white px-4 py-2 text-sm disabled:opacity-50">
                    Schedule Post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showRegenerateModal ? (
        <RegenerateModal
          onClose={() => setShowRegenerateModal(false)}
          onSubmit={async (instructions) => {
            setShowRegenerateModal(false);
            await generate(mode, instructions);
          }}
        />
      ) : null}
    </div>
  );
};

const RegenerateModal: React.FC<{ onClose: () => void; onSubmit: (instructions: string) => void }> = ({
  onClose,
  onSubmit,
}) => {
  const [instructions, setInstructions] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-[#111827]">Regenerate Post</h3>
        <p className="mt-1 text-sm text-[#6B7280]">Describe how you want the next version changed.</p>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          className="mt-3 w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#701CC0]"
          placeholder="Example: make it more concise, add a stronger CTA, and focus on dental customer retention."
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" onClick={() => onSubmit(instructions)} className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm">
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientViewOutreachSection;
