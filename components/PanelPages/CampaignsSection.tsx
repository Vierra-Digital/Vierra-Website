import React, { useEffect, useMemo, useState, useRef } from "react";
import { FiPlus, FiX, FiCheck, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import { Inter } from "next/font/google";
import { useDraftGuard } from "@/hooks/useDraftGuard";
import { useClientOptions } from "@/hooks/useClientOptions";
import { useActiveClient } from "@/lib/activeClient";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ConfirmActionModal from "@/components/ui/ConfirmActionModal";
import CampaignDetail from "./CampaignsSection/CampaignDetail";
import { panelFetch } from "@/lib/panelFetch";

const inter = Inter({ subsets: ["latin"] });

export type Campaign = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  sendProvider: "internal" | "smartlead" | "brevo";
  companyId: string;
  accountId: string;
  accountEmail: string | null;
  sendDelaySeconds: number;
  sendJitterSeconds: number;
  dailySendLimit: number;
  enrollOnSignal?: boolean;
  scheduledStartAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  stepCount?: number;
  contactCount?: number;
};

/* Status chips on the panel's dark surface.
   These were Tailwind's light pairs (bg-*-100 with text-*-800), which the .email-shell overrides do
   not remap — that list covers the panel's own hexes, not Tailwind's numbered palette — so every
   chip rendered as a bright pill on a dark row. A translucent tint with light text of the same hue
   keeps each status distinguishable while sitting on the surface instead of punching through it. */
export const STATUS_STYLE: Record<Campaign["status"], string> = {
  draft: "bg-white/10 text-[#C9C4DC]",
  active: "bg-green-500/15 text-green-300",
  paused: "bg-amber-500/15 text-amber-300",
  completed: "bg-blue-500/15 text-blue-300",
  cancelled: "bg-red-500/15 text-red-300",
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
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  // Campaigns are strictly scoped to one company (unlike Contacts/Analytics, there's no merged
  // "every client" view here — a campaign belongs to exactly one client's outreach), and this page
  // previously gave no indication of which company panelFetch was actually scoping the list to, or
  // any way to change it without leaving for the Clients page. A newly-created campaign for a
  // client other than whichever was last active would silently not appear in this list at all.
  const { activeClient, setActiveClient } = useActiveClient();
  const clientOptions = useClientOptions();

  /** Rows after the search box and status filter. */
  const visibleCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (campaignStatusFilter !== "all" && campaign.status !== campaignStatusFilter) return false;
      if (!query) return true;
      return `${campaign.name} ${campaign.accountEmail || ""} ${campaign.sendProvider}`
        .toLowerCase()
        .includes(query);
    });
  }, [campaigns, campaignSearch, campaignStatusFilter]);

  /**
   * Summary tiles. Derived from the loaded rows rather than fetched separately, so the numbers
   * can never disagree with the table underneath them.
   */
  const campaignSummary = useMemo(
    () => [
      { label: "Active", value: campaigns.filter((c) => c.status === "active").length },
      { label: "Draft", value: campaigns.filter((c) => c.status === "draft").length },
      { label: "Paused", value: campaigns.filter((c) => c.status === "paused").length },
      { label: "Contacts", value: campaigns.reduce((total, c) => total + (c.contactCount ?? 0), 0) },
    ],
    [campaigns]
  );

  const deleteCampaign = async () => {
    if (!campaignToDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete campaign.");
      }
      setCampaignToDelete(null);
      await loadCampaigns();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete campaign.");
    } finally {
      setDeleting(false);
    }
  };

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      // no-store: this reloads right after create/delete/status-change writes, and the
      // server's Cache-Control on this endpoint would otherwise serve the pre-write list.
      const res = await panelFetch("/api/campaigns", { cache: "no-store" });
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
  }, [activeClient?.id]);

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
    <div className="w-full h-full bg-white text-[#111014] flex flex-col overflow-y-auto">
      <div className="flex-1 flex justify-center px-6 pb-10">
        <div className="mx-auto w-full max-w-[1680px] flex flex-col">
          {/* Header: one block with a single margin instead of a title carrying its own
              mt-6/mb-6 inside a row that also set mb-2, which is what made the spacing here
              read as arbitrary. */}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Campaigns</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Sequenced outreach — steps, contacts and sending account per campaign.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={activeClient?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    setActiveClient(null);
                    return;
                  }
                  const client = clientOptions.find((c) => c.id === id);
                  if (client) setActiveClient(client);
                }}
                title="Campaigns belong to one client — this picks which client's campaigns you're viewing/creating."
                className="min-h-10 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]/30"
              >
                <option value="">Vierra (no client selected)</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-[#701CC0] px-5 text-sm font-semibold text-white hover:bg-[#5f17a5]"
              >
                <FiPlus className="w-4 h-4" />
                New Campaign
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner label="Loading campaigns..." />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
              <p className="text-sm font-medium text-[#374151]">No campaigns yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                A campaign sends a sequence of steps to a list of contacts from one of your inboxes.
              </p>
              <button
                onClick={() => setShowNewCampaign(true)}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-[#701CC0] px-5 text-sm font-semibold text-white hover:bg-[#5f17a5]"
              >
                <FiPlus className="w-4 h-4" />
                New Campaign
              </button>
            </div>
          ) : (
            <>
              {/* Summary of what is loaded. Derived from the same rows as the table, so it can
                  never disagree with what is listed below it. */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {campaignSummary.map((tile) => (
                  <div key={tile.label} className="rounded-xl border border-[#ECEAF1] bg-white px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">{tile.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-[#111827]">{tile.value}</p>
                  </div>
                ))}
              </div>

              {/* Search and status filter. With more than a handful of campaigns the table alone
                  offered no way to narrow it. */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={campaignSearch}
                  onChange={(event) => setCampaignSearch(event.target.value)}
                  placeholder="Search campaigns or sender…"
                  aria-label="Search campaigns"
                  className="min-w-0 flex-1 rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0]/25"
                />
                <select
                  value={campaignStatusFilter}
                  onChange={(event) => setCampaignStatusFilter(event.target.value)}
                  aria-label="Filter by status"
                  className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#701CC0]/25"
                >
                  <option value="all">All statuses</option>
                  {(Object.keys(STATUS_LABEL) as Campaign["status"][]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#ECEAF1] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-[#ECEAF1] bg-[#FAFAFB]">
                      <tr>
                        {[
                          { label: "Name", align: "text-left" },
                          { label: "Status", align: "text-left" },
                          { label: "Provider", align: "text-left" },
                          { label: "Steps", align: "text-right" },
                          { label: "Contacts", align: "text-right" },
                          { label: "Sender", align: "text-left" },
                          { label: "Created", align: "text-left" },
                          { label: "", align: "text-right" },
                        ].map((column) => (
                          <th
                            key={column.label || "actions"}
                            className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] ${column.align}`}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EFF6]">
                      {visibleCampaigns.map((c) => (
                        <tr
                          key={c.id}
                          className="cursor-pointer transition-colors hover:bg-[#F8F4FF]"
                          onClick={() => setSelectedCampaignId(c.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-[#111827]">{c.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[c.status]}`}
                            >
                              {STATUS_LABEL[c.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm capitalize text-[#4A465C]">{c.sendProvider}</td>
                          {/* Counts right-aligned and tabular so columns of digits line up. */}
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#111827]">{c.stepCount ?? 0}</td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-[#111827]">{c.contactCount ?? 0}</td>
                          <td className="px-4 py-3 text-sm text-[#4A465C]">{c.accountEmail || "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#6B7280]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {c.status === "draft" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteError("");
                                  setCampaignToDelete(c);
                                }}
                                className="rounded p-1.5 text-[#9CA3AF] transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Delete campaign"
                                aria-label={`Delete ${c.name}`}
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCampaigns.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[#6B7280]">
                    No campaigns match this search.
                  </p>
                ) : null}
              </div>
            </>
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

      <ConfirmActionModal
        dark
        isOpen={campaignToDelete !== null}
        title="Delete campaign?"
        message={
          <>
            {`Permanently delete "${campaignToDelete?.name}"? This can't be undone.`}
            {deleteError ? <span className="mt-2 block text-red-600">{deleteError}</span> : null}
          </>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={deleteCampaign}
        onCancel={() => {
          if (deleting) return;
          setCampaignToDelete(null);
          setDeleteError("");
        }}
      />
    </div>
  );
};

type EmailAccount = { id: string; accountEmail: string };
type BrevoSender = { email: string; name: string; active: boolean };
type EmailTemplate = { id: string; name: string; subject: string | null };
type ContactTag = { id: string; name: string; color: string };
type ContactOption = { id: string; firstName: string | null; lastName: string | null; email: string };
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
const MOCK_ACCOUNTS: EmailAccount[] = [{ id: "mock-account", accountEmail: "Test mailbox (mock — not connected, nothing is sent)" }];
const isMockAccountId = (id: string) => MOCK_ACCOUNTS.some((a) => a.id === id);
const isMockTemplateId = (id: string) => id === "mock-template";
const isMockCampaignId = (id: string | null) => !!id && id.startsWith("mock-");

const NewCampaignModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const mutationPending = useRef(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [brevoSenders, setBrevoSenders] = useState<BrevoSender[]>([]);
  const [brevoSendersError, setBrevoSendersError] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tags, setTags] = useState<ContactTag[]>([]);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sendProvider, setSendProvider] = useState<"internal" | "brevo">("internal");
  const [accountId, setAccountId] = useState("");
  // Only used when sendProvider is "brevo" and no existing connected mailbox is picked — Brevo
  // doesn't need a real SMTP-connected account, just an email identity to send/reply as.
  const [senderEmail, setSenderEmail] = useState("");

  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [newStepTemplateId, setNewStepTemplateId] = useState("");
  const [newStepDelayDays, setNewStepDelayDays] = useState(0);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // Individually-picked contacts, additive with the tag filter above — see
  // lib/campaigns/audienceSync.ts's AudienceFilter: a union, not a replacement, so someone can be
  // included regardless of how (or whether) their tags happen to be set up.
  const [selectedContacts, setSelectedContacts] = useState<ContactOption[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [preflightBlockers, setPreflightBlockers] = useState<string[]>([]);

  const canClose = useDraftGuard(Boolean(name || campaignId), "campaign wizard", "email", saving);
  const closeWizard = () => {
    if (mutationPending.current) return;
    void (async () => { if (await canClose()) onClose(); })();
  };

  // Lazy: only fetch Brevo's sender list once someone actually picks that provider, so a
  // BREVO_API_KEY-less setup never surfaces an error for reps who only use internal campaigns.
  useEffect(() => {
    if (sendProvider !== "brevo" || brevoSenders.length > 0 || brevoSendersError) return;
    (async () => {
      try {
        const res = await fetch("/api/campaigns/brevo-senders");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load Brevo senders");
        setBrevoSenders(data.senders || []);
      } catch (e: any) {
        setBrevoSendersError(e?.message || "Failed to load Brevo senders.");
      }
    })();
  }, [sendProvider, brevoSenders.length, brevoSendersError]);

  useEffect(() => {
    (async () => {
      try {
        // scopeToCompany: a mailbox's company_id is fixed at connection time, and picking one
        // that belongs to a different company than this draft (resolved the same way the create
        // call below resolves it, via panelFetch's active-client injection) fails validation on
        // submit with a confusing "must reference one of your connected mailboxes" — so this
        // filters to only the mailboxes that will actually work, instead of listing every mailbox
        // across every client and letting most of them silently be wrong picks.
        const [accountsRes, templatesRes, tagsRes] = await Promise.all([
          panelFetch("/api/email/accounts?scopeToCompany=1"),
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

  // Debounced contact search for the Audience step's "add specific contacts" picker — searching
  // on every keystroke would otherwise fire a request per character.
  useEffect(() => {
    const q = contactQuery.trim();
    // Nothing to search — the results dropdown already only renders when contactQuery is
    // non-empty, so there's no stale-results case to clear here.
    if (!q) return;
    const handle = setTimeout(async () => {
      setContactSearchLoading(true);
      try {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (res.ok) {
          setContactResults(
            (data.contacts || []).map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email }))
          );
        }
      } catch {
        /* search is best-effort; leave whatever results are already showing */
      } finally {
        setContactSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [contactQuery]);

  // Draft creation (step 0), sequence steps (step 1), audience enrollment (step 2), and launch
  // (step 3's button) are all real API calls now — a mock campaign/account/template still short-
  // circuits to local-only state, for offline testing of the wizard UI itself.
  const goNext = async () => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setError("");
    mutationPending.current = true;
    setSaving(true);
    try {
      if (wizardStep === 0) {
        if (campaignId) { setWizardStep(1); return; }
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }
        if (isMockAccountId(accountId)) {
          setCampaignId(`mock-${crypto.randomUUID()}`);
          setWizardStep(1);
          return;
        }
        const useAccountId = accountId && !isMockAccountId(accountId) ? accountId : "";
        if (sendProvider === "internal" && !useAccountId) {
          setError("A connected mailbox is required for internal-provider campaigns.");
          return;
        }
        if (sendProvider === "brevo" && !useAccountId && !senderEmail.trim()) {
          setError("Pick a connected mailbox or enter a sender email.");
          return;
        }
        const body: Record<string, unknown> = { name: name.trim(), sendProvider };
        if (useAccountId) body.accountId = useAccountId;
        else body.accountEmail = senderEmail.trim();

        const res = await panelFetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
        if (isMockCampaignId(campaignId)) {
          setEnrolledCount(0);
          setPreflightBlockers([]);
          setWizardStep(3);
          return;
        }
        // One call, not "PATCH audienceFilter then POST /sync" — those were two separate
        // round-trips for what pages/api/campaigns/[id]/audience.ts already does atomically, so a
        // network failure between them used to leave the filter saved but nothing enrolled, with
        // no visible sign of that when the draft was reopened later.
        const audienceRes = await fetch(`/api/campaigns/${campaignId}/audience`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: selectedTagIds, contactIds: selectedContacts.map((c) => c.id) }),
        });
        const audienceData = await audienceRes.json().catch(() => ({}));
        if (!audienceRes.ok) throw new Error(audienceData.message || "Failed to enroll audience");
        setEnrolledCount(audienceData.enrolledCount ?? 0);

        // Surface the same launch blockers (missing mailing address, zero audience, etc.) the
        // campaign detail view already shows, instead of only finding out after clicking Launch.
        const campaignRes = await fetch(`/api/campaigns/${campaignId}`);
        const campaignData = await campaignRes.json().catch(() => ({}));
        setPreflightBlockers(campaignRes.ok ? campaignData.preflight?.blockers ?? [] : []);

        setWizardStep(3);
        return;
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const addStep = async () => {
    if (mutationPending.current) return;
    if (!campaignId) return;
    if (!newStepTemplateId) {
      setError("Pick a template for this step.");
      return;
    }
    setError("");
    if (isMockCampaignId(campaignId) || isMockTemplateId(newStepTemplateId)) {
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
      return;
    }
    mutationPending.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: newStepTemplateId, delayDays: newStepDelayDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add step");
      setSteps((prev) => [...prev, data.step]);
      setNewStepTemplateId("");
      setNewStepDelayDays(0);
    } catch (e: any) {
      setError(e?.message || "Failed to add step.");
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const removeStep = async (stepId: string) => {
    if (isMockCampaignId(campaignId) || stepId.startsWith("mock-")) {
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      return;
    }
    if (!campaignId) return;
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/steps/${stepId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to remove step");
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
    } catch (e: any) {
      setError(e?.message || "Failed to remove step.");
    }
  };

  const launch = async () => {
    if (mutationPending.current) return;
    if (!campaignId) return;
    setError("");
    if (isMockCampaignId(campaignId)) {
      onDone();
      return;
    }
    mutationPending.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to launch campaign");
      onDone();
    } catch (e: any) {
      setError(e?.message || "Failed to launch campaign.");
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      zIndexClass="z-50"
      backdropClassName="bg-[#14101E]/55 backdrop-blur-sm"
      cardClassName="email-dialog-dark rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      label="New Campaign"
      onClose={closeWizard}
      closeOnBackdrop={!saving}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-[#111827]">New Campaign</h3>
        <button onClick={closeWizard} className="text-[#6B7280] hover:text-[#111827]">
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

      {wizardStep === 0 && campaignId && <p className="mb-3 text-sm">Draft already created. Sender and name are fixed for this wizard; continue to edit its sequence and audience.</p>}
      {wizardStep === 0 && (
        <fieldset disabled={Boolean(campaignId) || saving} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
              placeholder="Q3 Outreach — SMBs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Send Provider</label>
            <div className="flex gap-2">
              {(["internal", "brevo"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSendProvider(p)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                    sendProvider === p
                      ? "border-[#701CC0] bg-[#F5EEFC] text-[#701CC0]"
                      : "border-[#E5E7EB] text-[#374151] hover:bg-gray-50"
                  }`}
                >
                  {p === "internal" ? "Internal (SMTP)" : "Brevo"}
                </button>
              ))}
            </div>
            {sendProvider === "brevo" && (
              <p className="mt-2 text-xs text-[#9CA3AF]">
                Temporary stopgap while Smartlead is unverified — see schema_v2_campaigns_brevo_integration.md.
                Sends through Brevo&apos;s API rather than this mailbox&apos;s own SMTP connection.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">
              {sendProvider === "internal" ? "Sender Account" : "Sender Account (optional)"}
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
            >
              <option value="">Select a connected mailbox…</option>
              {accounts.length > 0 && (
                <optgroup label="Connected mailboxes">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountEmail}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Testing only">
                {MOCK_ACCOUNTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.accountEmail}</option>
                ))}
              </optgroup>
            </select>
            {isMockAccountId(accountId) && (
              <p className="mt-2 text-xs text-amber-600">
                Mock account — this campaign won&apos;t be saved and won&apos;t appear in your campaigns list.
              </p>
            )}
          </div>
          {sendProvider === "brevo" && !accountId && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Sender Email</label>
              {brevoSendersError ? (
                <p className="text-xs text-red-600">{brevoSendersError}</p>
              ) : (
                <select
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
                >
                  <option value="">
                    {brevoSenders.length === 0 ? "Loading senders…" : "Select a Brevo sender…"}
                  </option>
                  {brevoSenders.map((s) => (
                    <option key={s.email} value={s.email}>
                      {s.email} {s.active ? "" : "(not verified yet)"}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-2 text-xs text-[#9CA3AF]">
                Pulled from your Brevo account&apos;s registered senders. Unverified ones will still send but land
                proxied through Brevo&apos;s own domain until verified in Brevo&apos;s dashboard.
              </p>
            </div>
          )}
        </fieldset>
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
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
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
                  className="w-24 border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
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
            Leave everything below empty to enroll every contact across the company. Check tags and/or add specific
            contacts to narrow the audience — either one includes a contact, so the two combine rather than both
            being required.
          </p>
          <div>
            <p className="text-sm font-medium text-[#374151] mb-2">Tags (only your own are shown)</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-sm text-[#111827]">
                  <input
                    type="checkbox"
                    aria-label={tag.name}
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

          <div>
            <p className="text-sm font-medium text-[#374151] mb-2">Specific contacts</p>
            <input
              type="text"
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
            />
            {contactQuery.trim() && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-[#E5E7EB] rounded-lg divide-y divide-[#F3F4F6]">
                {contactSearchLoading ? (
                  <p className="px-3 py-2 text-xs text-[#9CA3AF]">Searching…</p>
                ) : contactResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#9CA3AF]">No matching contacts.</p>
                ) : (
                  contactResults.map((c) => {
                    const alreadyPicked = selectedContacts.some((s) => s.id === c.id);
                    const label = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={alreadyPicked}
                        onClick={() => {
                          setSelectedContacts((prev) => [...prev, c]);
                          setContactQuery("");
                        }}
                        className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <span className="text-[#111827]">{label}</span>
                        <span className="text-xs text-[#9CA3AF]">{alreadyPicked ? "Added" : c.email}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedContacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedContacts.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F5EEFC] text-[#701CC0] text-xs px-2 py-1"
                  >
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                    <button
                      type="button"
                      aria-label={`Remove ${c.email}`}
                      onClick={() => setSelectedContacts((prev) => prev.filter((x) => x.id !== c.id))}
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center py-4">
            <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
              {preflightBlockers.length > 0 ? (
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                    <FiAlertTriangle className="h-6 w-6" />
                  </span>
                </span>
              ) : (
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                    <FiCheck className="h-6 w-6" />
                  </span>
                </span>
              )}
            </div>
            <h4 className="text-lg font-semibold text-[#111827] mb-1">
              {preflightBlockers.length > 0 ? "Not ready to launch yet" : "Ready to launch"}
            </h4>
            <p className="text-sm text-[#6B7280]">
              {steps.length} step{steps.length === 1 ? "" : "s"} · {enrolledCount ?? 0} contact{enrolledCount === 1 ? "" : "s"} enrolled
            </p>
            {preflightBlockers.length > 0 && (
              <div className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                {preflightBlockers.map((blocker) => (
                  <p key={blocker} className="text-sm text-amber-800">
                    {blocker}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E7EB]">
        <button
          onClick={() => (wizardStep === 0 ? closeWizard() : setWizardStep((s) => s - 1))}
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
