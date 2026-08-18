import React, { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import type { Campaign } from "../CampaignsSection";
import ContactsTab from "./ContactsTab";
import AnalyticsTab from "./AnalyticsTab";

const TABS = ["Overview", "Contacts", "Analytics"] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

type CampaignStep = {
  id: string;
  stepOrder: number;
  name: string | null;
  templateId: string | null;
  delayDays: number;
};

type FailedContact = {
  id: string;
  email: string;
  reason: string;
  failedAt: string | null;
  attempts: number;
  gaveUp: boolean;
};

const DETAIL_CACHE_TTL_MS = 20_000;
const detailCache = new Map<
  string,
  { data: { campaign: Campaign | null; steps: CampaignStep[]; failed: FailedContact[] }; ts: number }
>();

const CampaignDetail: React.FC<{ campaignId: string; onBack: () => void }> = ({ campaignId, onBack }) => {
  const cached = detailCache.get(campaignId);
  const cacheFresh = !!cached && Date.now() - cached.ts < DETAIL_CACHE_TTL_MS;

  const [campaign, setCampaign] = useState<Campaign | null>(cached?.data.campaign ?? null);
  const [steps, setSteps] = useState<CampaignStep[]>(cached?.data.steps ?? []);
  const [failed, setFailed] = useState<FailedContact[]>(cached?.data.failed ?? []);
  const [loading, setLoading] = useState(!cacheFresh);
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(
    async (force = false) => {
      const entry = detailCache.get(campaignId);
      if (!force && entry && Date.now() - entry.ts < DETAIL_CACHE_TTL_MS) {
        setCampaign(entry.data.campaign);
        setSteps(entry.data.steps);
        setFailed(entry.data.failed);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [campaignRes, stepsRes, failedRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch(`/api/campaigns/${campaignId}/steps`),
          fetch(`/api/campaigns/${campaignId}/failed`),
        ]);
        const nextCampaign = campaignRes.ok ? (await campaignRes.json()).campaign : null;
        const nextSteps = stepsRes.ok ? (await stepsRes.json()).steps || [] : [];
        const nextFailed = failedRes.ok ? (await failedRes.json()).failed || [] : [];
        setCampaign(nextCampaign);
        setSteps(nextSteps);
        setFailed(nextFailed);
        detailCache.set(campaignId, { data: { campaign: nextCampaign, steps: nextSteps, failed: nextFailed }, ts: Date.now() });
      } catch (e) {
        console.error("Error loading campaign detail:", e);
      } finally {
        setLoading(false);
      }
    },
    [campaignId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const transition = async (status: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update campaign");
      setCampaign(data.campaign);
      const entry = detailCache.get(campaignId);
      if (entry) detailCache.set(campaignId, { ...entry, data: { ...entry.data, campaign: data.campaign } });
    } catch (e: any) {
      alert(e?.message || "Failed to update campaign.");
    } finally {
      setBusy(false);
    }
  };

  const patchEnrollOnSignal = async (enrollOnSignal: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollOnSignal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update campaign");
      setCampaign(data.campaign);
      const entry = detailCache.get(campaignId);
      if (entry) detailCache.set(campaignId, { ...entry, data: { ...entry.data, campaign: data.campaign } });
    } catch (e: any) {
      alert(e?.message || "Failed to update campaign.");
    } finally {
      setBusy(false);
    }
  };

  const runSendQueueTick = async () => {
    setBusy(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/campaigns/send-queue/tick", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to run send queue");
      setSyncMessage(`Sent ${data.sent}, failed ${data.failed}, skipped ${data.skipped} (of ${data.processed} due).`);
    } catch (e: any) {
      setSyncMessage(e?.message || "Failed to run send queue.");
    } finally {
      setBusy(false);
    }
  };

  const deleteCampaign = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete campaign.");
      }
      detailCache.delete(campaignId);
      setConfirmDelete(false);
      onBack();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete campaign.");
    } finally {
      setDeleting(false);
    }
  };

  const syncAudience = async () => {
    setBusy(true);
    setSyncMessage("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to sync audience");
      setSyncMessage(`Enrolled ${data.enrolledCount} new contact${data.enrolledCount === 1 ? "" : "s"} (${data.contactCount} total).`);
      load(true);
    } catch (e: any) {
      setSyncMessage(e?.message || "Failed to sync audience.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !campaign) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinner label="Loading campaign..." />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white text-[#111014] flex flex-col">
      <div className="flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
        <div className="w-full max-w-6xl flex flex-col h-full">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] mt-6 mb-2 w-fit">
            <FiArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </button>

          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#111827]">{campaign.name}</h1>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[campaign.status]}`}>
                {campaign.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {campaign.status === "draft" && (
                <button onClick={() => transition("active")} disabled={busy} className="px-3 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50">
                  Launch
                </button>
              )}
              {campaign.status === "active" && (
                <>
                  <button onClick={runSendQueueTick} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#374151] hover:bg-gray-200 disabled:opacity-50">
                    <FiRefreshCw className="w-4 h-4" /> Run Send Queue
                  </button>
                  <button onClick={() => transition("paused")} disabled={busy} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-gray-50 disabled:opacity-50">
                    Pause
                  </button>
                </>
              )}
              {campaign.status === "paused" && (
                <button onClick={() => transition("active")} disabled={busy} className="px-3 py-2 rounded-lg bg-[#701CC0] text-white text-sm font-medium hover:bg-[#5f17a5] disabled:opacity-50">
                  Resume
                </button>
              )}
              {(campaign.status === "active" || campaign.status === "paused" || campaign.status === "draft") && (
                <button onClick={() => transition("cancelled")} disabled={busy} className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Cancel
                </button>
              )}
              <button onClick={syncAudience} disabled={busy} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-gray-50 disabled:opacity-50">
                Sync Audience
              </button>
              {campaign.status === "draft" && (
                <button
                  onClick={() => {
                    setDeleteError("");
                    setConfirmDelete(true);
                  }}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <label className="mb-4 flex items-center gap-2 text-sm text-[#374151]">
            <input
              type="checkbox"
              checked={!!campaign.enrollOnSignal}
              disabled={busy}
              onChange={(e) => patchEnrollOnSignal(e.target.checked)}
              className="h-4 w-4 rounded border-[#D1D5DB] text-[#701CC0] focus:ring-[#701CC0]"
            />
            <span>
              Auto-enroll signal-interested contacts here
              <span className="ml-1 text-xs text-[#9CA3AF]">
                — when someone clicks a tracked link, add them to this sequence
              </span>
            </span>
          </label>

          {syncMessage && <p className="text-xs text-[#6B7280] mb-4">{syncMessage}</p>}

          <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-4">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  tab === t ? "border-[#701CC0] text-[#701CC0]" : "border-transparent text-[#6B7280] hover:text-[#111827]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Overview" && (
            <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
                <h3 className="text-sm font-semibold text-[#111827] mb-3">Send Settings</h3>
                <dl className="text-sm space-y-2">
                  <div className="flex justify-between"><dt className="text-[#6B7280]">Sender</dt><dd>{campaign.accountEmail}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#6B7280]">Send Delay</dt><dd>{campaign.sendDelaySeconds}s ± {campaign.sendJitterSeconds}s</dd></div>
                  <div className="flex justify-between"><dt className="text-[#6B7280]">Daily Limit</dt><dd>{campaign.dailySendLimit}/day</dd></div>
                  <div className="flex justify-between"><dt className="text-[#6B7280]">Contacts Enrolled</dt><dd>{campaign.contactCount ?? 0}</dd></div>
                </dl>
              </div>
              <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
                <h3 className="text-sm font-semibold text-[#111827] mb-3">Sequence ({steps.length} step{steps.length === 1 ? "" : "s"})</h3>
                <ol className="text-sm space-y-2">
                  {steps.map((s, i) => (
                    <li key={s.id} className="flex justify-between">
                      <span className="text-[#374151]">Step {i + 1}{s.name ? ` — ${s.name}` : ""}</span>
                      <span className="text-[#6B7280]">{i === 0 ? "on enrollment" : `+${s.delayDays}d`}</span>
                    </li>
                  ))}
                  {steps.length === 0 && <li className="text-[#9CA3AF]">No steps yet.</li>}
                </ol>
              </div>
            </div>
            {failed.length > 0 && (
              <div className="bg-white rounded-lg border border-red-200 p-4">
                <h3 className="text-sm font-semibold text-red-700 mb-3">Failed sends ({failed.length})</h3>
                <ul className="text-sm divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {failed.map((f) => (
                    <li key={f.id} className="py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[#374151] truncate">{f.email}</p>
                        <p className="text-xs text-[#9CA3AF] truncate">{f.reason || "Unknown error"}</p>
                      </div>
                      <span className={`shrink-0 text-xs ${f.gaveUp ? "text-red-600" : "text-amber-600"}`}>
                        {f.gaveUp ? "gave up" : `retry ${f.attempts}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          )}

          {tab === "Contacts" && <ContactsTab campaignId={campaignId} />}
          {tab === "Analytics" && <AnalyticsTab campaignId={campaignId} />}
        </div>
      </div>

      <ConfirmActionModal
        isOpen={confirmDelete}
        title="Delete campaign?"
        message={
          <>
            {`Permanently delete "${campaign.name}"? This can't be undone.`}
            {deleteError ? <span className="mt-2 block text-red-600">{deleteError}</span> : null}
          </>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={deleteCampaign}
        onCancel={() => {
          if (deleting) return;
          setConfirmDelete(false);
          setDeleteError("");
        }}
      />
    </div>
  );
};

export default CampaignDetail;
