import React, { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiRefreshCw, FiCheck } from "react-icons/fi";
import { inter } from "@/lib/fonts";
import Modal from "@/components/ui/Modal";
import RowActionMenu, { RowActionMenuItem } from "@/components/ui/RowActionMenu";

/** Strict email-shape check, same pattern as TeamPanelSection.tsx's invite modal. */
const isValidEmail = (value: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);

type Representative = { id: string; name: string | null; email: string; created_at: string };
type PendingInvite = { id: string; email: string; expires_at: string; created_at: string };

/**
 * Client self-service team management (see docs/ROLE_MODEL_REDESIGN.md's "v2" section) — lets an
 * existing representative invite a colleague to the same client company, e.g. so Exactus's two
 * people both see the same campaigns/events. Deliberately simpler than TeamPanelSection.tsx's
 * staff-facing equivalent: no role/position/mentor concepts — every representative is flat and
 * identical.
 */
const ClientTeamSection: React.FC = () => {
  const [representatives, setRepresentatives] = useState<Representative[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/team");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Failed to load your team.");
        return;
      }
      setRepresentatives(Array.isArray(data?.representatives) ? data.representatives : []);
      setInvitations(Array.isArray(data?.invitations) ? data.invitations : []);
    } catch {
      setError("Couldn't reach the team endpoint.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const rescind = async (id: string) => {
    try {
      const res = await fetch(`/api/client/team/${id}`, { method: "DELETE" });
      if (res.ok) setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* best-effort — a stale row just stays until the next refresh */
    }
  };

  return (
    <div className="flex-1 flex justify-center px-6 pt-2 pb-10">
      <div className="w-full max-w-4xl flex flex-col">
        <div className="w-full flex justify-between items-center mb-2">
          <h1 className={`text-2xl font-semibold text-[#111827] mt-6 mb-2 ${inter.className}`}>Team</h1>
        </div>
        <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
          Everyone here sees the same campaigns, events, and data for your account.
        </p>

        <div className="flex items-center justify-between mb-3">
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
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[#701CC0] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#5f17a5]"
          >
            <FiPlus className="h-4 w-4" />
            Invite teammate
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#374151]">Loading your team…</p>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-dashed border-red-200 bg-red-50 px-6 py-16 text-center">
            <p className="text-sm font-medium text-red-700">Couldn&rsquo;t load your team</p>
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
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#ECEAF1] bg-white">
            <div className="divide-y divide-[#F1EFF6]">
              {(representatives || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{r.name || r.email}</p>
                    <p className="text-xs text-[#6B7280]">{r.email}</p>
                  </div>
                </div>
              ))}
              {invitations.map((i) => (
                <div key={i.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{i.email}</p>
                    <p className="text-xs text-[#9CA3AF]">Invited — awaiting acceptance</p>
                  </div>
                  <RowActionMenu label={`Manage invite for ${i.email}`}>
                    <RowActionMenuItem
                      onClick={() => rescind(i.id)}
                      icon={<FiTrash2 className="w-4 h-4" />}
                      tone="danger"
                    >
                      Rescind Invite
                    </RowActionMenuItem>
                  </RowActionMenu>
                </div>
              ))}
              {(representatives?.length ?? 0) === 0 && invitations.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm font-medium text-[#374151]">Just you, for now</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                    Invite a teammate to give them the same access to your account.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteRepresentativeModal
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            setShowInvite(false);
            load();
          }}
        />
      )}
    </div>
  );
};

const InviteRepresentativeModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose,
  onCreated,
}) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/client/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to send invite");
      }
      setShowSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <Modal
        zIndexClass="z-[200]"
        backdropClassName="bg-black/50 backdrop-blur-sm"
        cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        label="Invite Sent"
        onClose={onCreated}
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <FiCheck className="h-6 w-6" />
              </span>
            </span>
          </div>
          <h3 className="text-xl font-semibold text-[#111827] mb-2">Invite Sent!</h3>
          <p className={`text-sm text-[#6B7280] mb-6 ${inter.className}`}>
            {email} will receive an email to set their password and join your team.
          </p>
          <button
            className="w-full rounded-lg px-4 py-2 bg-[#701CC0] text-white hover:bg-[#5f17a5] text-sm font-medium transition-colors"
            onClick={onCreated}
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
      label="Invite Teammate"
      onClose={onClose}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
          <FiPlus className="w-6 h-6 text-[#701CC0]" />
        </div>
        <h3 className="text-xl font-semibold text-[#111827]">Invite Teammate</h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#374151] mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
            email && !isValidEmail(email) ? "border-red-500 bg-red-50" : "border-[#E5E7EB]"
          }`}
          placeholder="teammate@yourcompany.com"
          required
        />
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting || !isValidEmail(email)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            submitting || !isValidEmail(email)
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#701CC0] text-white hover:bg-[#5f17a5]"
          }`}
        >
          {submitting ? "Sending…" : "Send Invite"}
        </button>
      </div>
    </Modal>
  );
};

export default ClientTeamSection;
