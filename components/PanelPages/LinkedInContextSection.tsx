import React, { useEffect, useMemo, useState } from "react";
import { Inter } from "next/font/google";
import PanelSectionHeader from "@/components/ui/PanelSectionHeader";
import SuccessStatusModal from "@/components/ui/SuccessStatusModal";

const inter = Inter({ subsets: ["latin"] });
const NON_RESIZABLE_TEXT_KEYS = new Set(["website", "brandTone"]);

export type LinkedInContextData = {
  client: { id: string; name: string; email: string; businessName: string };
  sessionId: string | null;
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
  editableAnswers: Record<string, string>;
  categories: Array<{
    id: string;
    label: string;
    fields: Array<{
      key: string;
      label: string;
      type: "text" | "textarea";
      rows?: number;
      value: string;
    }>;
  }>;
  assets: Array<{
    id: string;
    name: string;
    fileType: string;
    signingTokenId: string | null;
    previewUrl: string | null;
  }>;
};

type Props = {
  clientId?: string | null;
  title?: string;
  embedded?: boolean;
  onContextLoaded?: (context: LinkedInContextData) => void;
};

const LinkedInContextSection: React.FC<Props> = ({
  clientId,
  title = "Context",
  embedded = false,
  onContextLoaded,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [context, setContext] = useState<LinkedInContextData | null>(null);
  const [editableAnswers, setEditableAnswers] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string>("");

  useEffect(() => {
    let active = true;
    const fetchContext = async () => {
      setLoading(true);
      setError("");
      try {
        const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
        const response = await fetch(`/api/context/client${query}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Failed to load context");
        if (!active) return;

        const typed = payload as LinkedInContextData;
        setContext(typed);
        setEditableAnswers(typed.editableAnswers || {});
        if (typed.categories?.length) {
          setActiveCategory((current) => current || typed.categories[0].id);
        }
        onContextLoaded?.(typed);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load context");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchContext();
    return () => {
      active = false;
    };
  }, [clientId, onContextLoaded]);

  const hasOnboardingSignal = useMemo(() => {
    if (!editableAnswers) return false;
    const values = Object.values(editableAnswers);
    return values.some((item) => typeof item === "string" && item.trim().length > 0);
  }, [editableAnswers]);

  const activeFields = useMemo(() => {
    if (!context?.categories?.length) return [];
    return context.categories.find((category) => category.id === activeCategory)?.fields || [];
  }, [context, activeCategory]);

  const saveContext = async () => {
    setSaving(true);
    setShowSuccessModal(false);
    setError("");
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`/api/context/client${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editableAnswers }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to save context");
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save context");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
        <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
          <div className="w-full max-w-6xl flex flex-col h-full">
            {!embedded && <PanelSectionHeader title={title} />}
            <div className="py-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto" />
                <p className="mt-2 text-sm text-[#6B7280]">Loading Context Data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="w-full max-w-6xl flex flex-col h-full pb-16 lg:pb-24">
          {!embedded && <PanelSectionHeader title={title} />}

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm mb-5">
            {!hasOnboardingSignal ? (
              <p className="text-sm text-[#6B7280]">No onboarding answers found yet. You can still add them here.</p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-4">
              {(context?.categories || []).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeCategory === category.id
                      ? "bg-[#701CC0] text-white"
                      : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeFields.map((field) => (
                <label key={field.key} className="text-sm text-[#374151]">
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      value={editableAnswers[field.key] || ""}
                      rows={field.rows || 3}
                      onChange={(e) =>
                        setEditableAnswers((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-[#D1D5DB] px-3 py-2 outline-none focus:ring-2 focus:ring-[#701CC0] resize-y min-h-[88px]"
                    />
                  ) : NON_RESIZABLE_TEXT_KEYS.has(field.key) ? (
                    <input
                      value={editableAnswers[field.key] || ""}
                      onChange={(e) =>
                        setEditableAnswers((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-[#D1D5DB] px-3 py-2 outline-none focus:ring-2 focus:ring-[#701CC0]"
                    />
                  ) : (
                    <textarea
                      value={editableAnswers[field.key] || ""}
                      rows={2}
                      onChange={(e) =>
                        setEditableAnswers((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-[#D1D5DB] px-3 py-2 outline-none focus:ring-2 focus:ring-[#701CC0] resize-y min-h-[72px]"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={saveContext}
                className="rounded-lg bg-[#701CC0] text-white px-4 py-2 text-sm font-medium hover:bg-[#5d17a0] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Context"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-5">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">Image Assets (PNG/JPG)</h3>
              {context?.assets.length ? (
                <div className="mt-3 max-h-48 overflow-auto space-y-2">
                  {context.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] flex items-center justify-between"
                    >
                      <span className="truncate">{asset.name}</span>
                      <span className="text-xs text-[#6B7280] uppercase">{asset.fileType}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6B7280] mt-3">No image assets found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <SuccessStatusModal
        isOpen={showSuccessModal}
        title="Context Saved Successfully"
        message="Your context responses have been saved."
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
};

export default LinkedInContextSection;

