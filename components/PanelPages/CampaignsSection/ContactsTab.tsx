import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Modal from "@/components/ui/Modal";
import ContactTimelineModal from "@/components/email/ContactTimelineModal";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "../CampaignsSection";

type CampaignContact = {
  id: string;
  contactEmail: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactBusiness: string | null;
  assignedTo: string | null;
  leadStatus: string;
  queueStatus: string;
  nextSendAt: string | null;
  lastSentAt: string | null;
};

type LeadStatusEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserName: string | null;
  changedByRule: string | null;
  note: string | null;
  createdAt: string;
};

const ContactsTab: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CampaignContact | null>(null);
  const [timelineEmail, setTimelineEmail] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("leadStatus", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/campaigns/${campaignId}/contacts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load contacts");
      const data = await res.json();
      setContacts(data.contacts || []);
      setStatusCounts(data.statusCounts || {});
    } catch (e) {
      console.error("Error loading campaign contacts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, statusFilter, search]);

  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            statusFilter === "all" ? "bg-[#701CC0] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All ({totalCount})
        </button>
        {LEAD_STATUS_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              statusFilter === status ? "bg-[#701CC0] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {LEAD_STATUS_LABELS[status]} ({statusCounts[status] ?? 0})
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search contacts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-80 mb-4 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner label="Loading contacts..." />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No contacts match this filter.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                {["Contact", "Business", "Status", "Queue", "Next Send"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#E5E7EB]">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-purple-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-4 text-sm">
                    <div className="font-medium text-[#111827]">{[c.contactFirstName, c.contactLastName].filter(Boolean).join(" ") || c.contactEmail}</div>
                    <div className="text-xs text-[#6B7280]">{c.contactEmail}</div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimelineEmail(c.contactEmail);
                      }}
                      className="mt-1 text-[11px] font-medium text-[#701CC0] hover:underline"
                    >
                      View timeline
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#111827]">{c.contactBusiness || "—"}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {LEAD_STATUS_LABELS[c.leadStatus] || c.leadStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#6B7280]">{c.queueStatus}</td>
                  <td className="px-4 py-4 text-sm text-[#6B7280]">{c.nextSendAt ? new Date(c.nextSendAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ContactDetailPanel
          campaignId={campaignId}
          contact={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            load();
          }}
        />
      )}

      {timelineEmail && <ContactTimelineModal email={timelineEmail} onClose={() => setTimelineEmail(null)} />}
    </div>
  );
};

const ContactDetailPanel: React.FC<{
  campaignId: string;
  contact: CampaignContact;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ campaignId, contact, onClose, onUpdated }) => {
  const [leadStatus, setLeadStatus] = useState(contact.leadStatus);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<LeadStatusEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/contacts/${contact.id}`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.leadStatusEvents || []);
        }
      } catch (e) {
        console.error("Error loading contact history:", e);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [campaignId, contact.id]);

  const saveStatus = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadStatus, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");
      onUpdated();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const claim = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to claim lead");
      onUpdated();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed to claim lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
      label="Lead Detail"
      onClose={onClose}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#111827]">
            {[contact.contactFirstName, contact.contactLastName].filter(Boolean).join(" ") || contact.contactEmail}
          </h3>
          <p className="text-sm text-[#6B7280]">{contact.contactEmail}</p>
        </div>
        <button onClick={onClose} className="text-[#6B7280] hover:text-[#111827]">
          <FiX className="w-5 h-5" />
        </button>
      </div>

      {!contact.assignedTo && (
        <button
          onClick={claim}
          disabled={saving}
          className="mb-4 w-full px-3 py-2 rounded-lg border border-[#701CC0] text-[#701CC0] text-sm font-medium hover:bg-purple-50 disabled:opacity-50"
        >
          Claim this lead
        </button>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-[#374151] mb-2">Status</label>
        <select
          value={leadStatus}
          onChange={(e) => setLeadStatus(e.target.value)}
          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
        >
          {LEAD_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[#374151] mb-2">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
          placeholder="Why the status changed…"
        />
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[#111827] mb-2">History</h4>
        {loadingHistory ? (
          <LoadingSpinner />
        ) : history.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">No status changes yet.</p>
        ) : (
          <ul className="space-y-2 max-h-40 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-xs text-[#6B7280] border-l-2 border-[#E5E7EB] pl-2">
                <span className="font-medium text-[#374151]">{LEAD_STATUS_LABELS[h.toStatus] || h.toStatus}</span>
                {" — "}
                {h.changedByUserName || (h.changedByRule ? `auto (${h.changedByRule})` : "system")}
                {" · "}
                {new Date(h.createdAt).toLocaleString()}
                {h.note ? <div className="italic">&quot;{h.note}&quot;</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E7EB]">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={saveStatus}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Status"}
        </button>
      </div>
    </Modal>
  );
};

export default ContactsTab;
