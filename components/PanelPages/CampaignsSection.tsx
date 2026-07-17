import React, { useEffect, useState } from "react";
import { FiPlus, FiX, FiCheck, FiTrash2 } from "react-icons/fi";
import { Inter } from "next/font/google";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CampaignDetail from "./CampaignsSection/CampaignDetail";

const inter = Inter({ subsets: ["latin"] });

export type Campaign = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  accountId: string;
  accountEmail: string | null;
  sendDelaySeconds: number;
  sendJitterSeconds: number;
  dailySendLimit: number;
  scheduledStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  stepCount?: number;
  contactCount?: number;
};

const STATUS_STYLE: Record<Campaign["status"], string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<Campaign["status"], string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  no_response: "No Response",
  reply: "Reply",
  follow_up: "Follow-Up",
  positive_response: "Positive Response",
  not_interested: "Not Interested",
  remove_contact: "Remove Contact",
  bad_timing: "Bad Timing",
  meeting_booked: "Meeting Booked",
  positive_response_closed: "Positive Response Closed",
};

export const LEAD_STATUS_ORDER = Object.keys(LEAD_STATUS_LABELS);

const CampaignsSection: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to load campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Error loading campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  if (selectedCampaignId) {
    return (
      <CampaignDetail
        campaignId={selectedCampaignId}
        onBack={() => {
          setSelectedCampaignId(null);
          loadCampaigns();
        }}
      />
    );
  }

  return (
    <div className="w-full h-full bg-white text-[#111014] flex flex-col">
      <div className="flex-1 flex justify-center px-6 pt-2">
        <div className="w-full max-w-6xl flex flex-col h-full">
          <div className="w-full flex justify-between items-center mb-2">
            <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Campaigns</h1>
            <button
              onClick={() => setShowNewCampaign(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5f17a5] text-sm font-medium"
            >
              <FiPlus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner label="Loading campaigns..." />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-3">No campaigns yet.</p>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-[#701CC0] text-white text-sm hover:bg-[#5f17a5]"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                New Campaign
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      {["Name", "Status", "Steps", "Contacts", "Sender", "Created"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#E5E7EB]">
                    {campaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-purple-50 cursor-pointer"
                        onClick={() => setSelectedCampaignId(c.id)}
                      >
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{c.name}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#111827]">{c.stepCount ?? 0}</td>
                        <td className="px-4 py-4 text-sm text-[#111827]">{c.contactCount ?? 0}</td>
                        <td className="px-4 py-4 text-sm text-[#111827]">{c.accountEmail || "—"}</td>
                        <td className="px-4 py-4 text-sm text-[#6B7280]">{new Date(c.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewCampaign && (
        <NewCampaignModal
          onClose={() => setShowNewCampaign(false)}
          onDone={() => {
            setShowNewCampaign(false);
            loadCampaigns();
          }}
        />
      )}
    </div>
  );
};

type EmailAccount = { id: string; account_email: string };
type EmailTemplate = { id: string; name: string; subject: string | null };
type ContactTag = { id: string; name: string; color: string };
type CampaignStep = {
  id: string;
  stepOrder: number;
  name: string | null;
  templateId: string | null;
  subjectOverride: string | null;
  delayDays: number;
};

const WIZARD_STEPS = ["Basic Info", "Sequence", "Audience", "Review & Launch"] as const;

// Fallback so the sequence step is completable even with no templates seeded yet (step-adding is still mocked).
const MOCK_TEMPLATES: EmailTemplate[] = [{ id: "mock-template", name: "Sample Template (mock)", subject: "Mock Subject" }];

// Always-available test option, kept visually separate from real mailboxes. Picking one skips
// the real draft-creation POST below (there's no matching row for the API to validate against).
const MOCK_ACCOUNTS: EmailAccount[] = [{ id: "mock-account", account_email: "Test mailbox (mock — not connected, nothing is sent)" }];
const isMockAccountId = (id: string) => MOCK_ACCOUNTS.some((a) => a.id === id);

const NewCampaignModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [wizardStep, setWizardStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tags, setTags] = useState<ContactTag[]>([]);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");

  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [newStepTemplateId, setNewStepTemplateId] = useState("");
  const [newStepDelayDays, setNewStepDelayDays] = useState(0);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [accountsRes, templatesRes, tagsRes] = await Promise.all([
          fetch("/api/email/accounts"),
          fetch("/api/gmail/templates"),
          fetch("/api/contacts/tags"),
        ]);
        const loadedTemplates = templatesRes.ok ? (await templatesRes.json()).templates || [] : [];
        if (accountsRes.ok) setAccounts((await accountsRes.json()).accounts || []);
        if (tagsRes.ok) setTags((await tagsRes.json()).tags || []);
        setTemplates(loadedTemplates.length > 0 ? loadedTemplates : MOCK_TEMPLATES);
      } catch (e) {
        console.error("Error loading campaign form options:", e);
        setTemplates(MOCK_TEMPLATES);
      }
    })();
  }, []);

  // Draft creation (step 0) is real and persists to the DB. Everything past it — sequence
  // steps, audience enrollment, and launch — stays mocked, so nothing in this wizard sends.
  const goNext = async () => {
    setError("");
    setSaving(true);
    try {
      if (wizardStep === 0) {
        if (!name.trim() || !accountId) {
          setError("Name and sender account are required.");
          return;
        }
        if (isMockAccountId(accountId)) {
          setCampaignId(`mock-${crypto.randomUUID()}`);
          setWizardStep(1);
          return;
        }
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), accountId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create campaign");
        setCampaignId(data.campaign.id);
        setWizardStep(1);
        return;
      }

      if (wizardStep === 1) {
        if (steps.length === 0) {
          setError("Add at least one sequence step.");
          return;
        }
        setWizardStep(2);
        return;
      }

      if (wizardStep === 2) {
        if (!campaignId) return;
        setEnrolledCount(0);
        setWizardStep(3);
        return;
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    if (!campaignId) return;
    if (!newStepTemplateId) {
      setError("Pick a template for this step.");
      return;
    }
    setError("");
    setSteps((prev) => [
      ...prev,
      {
        id: `mock-${crypto.randomUUID()}`,
        stepOrder: prev.length,
        name: null,
        templateId: newStepTemplateId,
        subjectOverride: null,
        delayDays: newStepDelayDays,
      },
    ]);
    setNewStepTemplateId("");
    setNewStepDelayDays(0);
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const launch = () => {
    if (!campaignId) return;
    setError("");
    onDone();
  };

  return (
    <Modal
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      label="New Campaign"
      onClose={onClose}
      closeOnBackdrop={!saving}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[#111827]">New Campaign</h3>
        <button onClick={onClose} className="text-[#6B7280] hover:text-[#111827]">
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                i <= wizardStep ? "bg-[#701CC0] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs ${inter.className} ${i === wizardStep ? "text-[#111827] font-medium" : "text-[#9CA3AF]"}`}>
              {label}
            </span>
            {i < WIZARD_STEPS.length - 1 && <div className="flex-1 h-px bg-[#E5E7EB]" />}
          </div>
        ))}
      </div>

      {wizardStep === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
              placeholder="Q3 Outreach — SMBs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Sender Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
            >
              <option value="">Select a connected mailbox…</option>
              {accounts.length > 0 && (
                <optgroup label="Connected mailboxes">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.account_email}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Testing only">
                {MOCK_ACCOUNTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_email}</option>
                ))}
              </optgroup>
            </select>
            {isMockAccountId(accountId) && (
              <p className="mt-2 text-xs text-amber-600">
                Mock account — this campaign won&apos;t be saved and won&apos;t appear in your campaigns list.
              </p>
            )}
          </div>
        </div>
      )}

      {wizardStep === 1 && (
        <div className="space-y-4">
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between border border-[#E5E7EB] rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium text-[#111827]">Step {i + 1}</span>
                    <span className="text-[#6B7280]"> — {templates.find((t) => t.id === s.templateId)?.name || "Template"} · +{s.delayDays}d</span>
                  </div>
                  <button onClick={() => removeStep(s.id)} className="text-red-500 hover:text-red-700">
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border border-dashed border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Template</label>
              <select
                value={newStepTemplateId}
                onChange={(e) => setNewStepTemplateId(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Delay Before Sending</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={newStepDelayDays}
                  onChange={(e) => setNewStepDelayDays(Number(e.target.value))}
                  className="w-24 border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
                />
                <span className="text-sm text-[#6B7280]">
                  day{newStepDelayDays === 1 ? "" : "s"} {steps.length === 0 ? "after enrollment" : "after the previous step"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {newStepDelayDays === 0
                  ? `Sends immediately ${steps.length === 0 ? "when a contact enrolls" : "after the previous step"}.`
                  : `Sends ${newStepDelayDays} day${newStepDelayDays === 1 ? "" : "s"} ${steps.length === 0 ? "after a contact enrolls" : "after the previous step"}.`}
              </p>
            </div>
            <button
              onClick={addStep}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#374151] hover:bg-gray-200"
            >
              <FiPlus className="w-4 h-4" />
              Add Step
            </button>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-[#374151]">
            Leave everything unchecked to enroll every contact across the company. Check tags to narrow the audience
            (only your own tags are shown).
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={(e) =>
                    setSelectedTagIds((prev) => (e.target.checked ? [...prev, tag.id] : prev.filter((id) => id !== tag.id)))
                  }
                />
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              </label>
            ))}
            {tags.length === 0 && <p className="text-xs text-[#9CA3AF]">You have no contact tags yet.</p>}
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center py-4">
            <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
              <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                  <FiCheck className="h-6 w-6" />
                </span>
              </span>
            </div>
            <h4 className="text-lg font-semibold text-[#111827] mb-1">Ready to launch</h4>
            <p className="text-sm text-[#6B7280]">
              {steps.length} step{steps.length === 1 ? "" : "s"} · {enrolledCount ?? 0} contact{enrolledCount === 1 ? "" : "s"} enrolled
            </p>
          </div>
        </div>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E7EB]">
        <button
          onClick={() => (wizardStep === 0 ? onClose() : setWizardStep((s) => s - 1))}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
        >
          {wizardStep === 0 ? "Cancel" : "Back"}
        </button>
        {wizardStep < 3 ? (
          <button
            onClick={goNext}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Next"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onDone}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={launch}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Launching…" : "Launch Now"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CampaignsSection;
