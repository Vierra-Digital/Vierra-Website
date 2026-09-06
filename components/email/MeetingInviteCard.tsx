import { useState } from "react";
import { FiCalendar, FiMapPin, FiUsers } from "react-icons/fi";
import { panelFetch } from "@/lib/panelFetch";
import type { MeetingInvite } from "@/components/email/types";

const RESPONSE_LABEL: Record<NonNullable<MeetingInvite["myResponse"]>, string> = {
  accepted: "Yes",
  declined: "No",
  tentative: "Maybe",
};

function formatRange(invite: MeetingInvite): string {
  const start = new Date(invite.startIso);
  const end = new Date(invite.endIso);
  if (invite.isAllDay) {
    return start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startTime} – ${endTime}`;
}

/**
 * Renders the Yes/No/Maybe card for an inbound calendar invite — the meeting equivalent of
 * Gmail's own rich cards. Responding sends a real iTIP REPLY to the organizer (see
 * pages/api/gmail/meeting-rsvp.ts); flight/hotel-style cards aren't reproducible generically
 * since those need the sender's own schema.org markup, so this covers meetings only.
 */
export default function MeetingInviteCard({
  invite,
  accountEmail,
  messageId,
  onResponded,
}: {
  invite: MeetingInvite;
  accountEmail: string;
  messageId: string;
  onResponded: (response: NonNullable<MeetingInvite["myResponse"]>) => void;
}) {
  const [sending, setSending] = useState<NonNullable<MeetingInvite["myResponse"]> | null>(null);
  const [error, setError] = useState("");
  const [changingResponse, setChangingResponse] = useState(false);

  const isCanceled = invite.method === "CANCEL";
  const showButtons = !isCanceled && (!invite.myResponse || changingResponse);

  const sendRsvp = async (response: NonNullable<MeetingInvite["myResponse"]>) => {
    const res = await panelFetch("/api/gmail/meeting-rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountEmail, messageId, response }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const err = new Error(payload?.message || "Failed to send your response.") as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
  };

  // The button flips to its "sending" look the instant it's clicked (see className below) — but a
  // look, not a promise, is worthless if the request underneath it can silently die. So a
  // transient failure (network drop, a 5xx) is retried automatically a few times with backoff
  // before anything is shown to the user; only a definitive rejection (4xx — e.g. no organizer to
  // reply to) or the last retry surfaces the error. Nothing here is dropped without either
  // succeeding or telling the user it didn't.
  const MAX_ATTEMPTS = 3;
  const respond = async (response: NonNullable<MeetingInvite["myResponse"]>) => {
    setSending(response);
    setError("");
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await sendRsvp(response);
        setChangingResponse(false);
        onResponded(response);
        setSending(null);
        return;
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        const retryable = !status || status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
    }
    setSending(null);
    setError(lastError instanceof Error ? lastError.message : "Failed to send your response.");
  };

  // Card sits directly in the email panel (not inside .email-body-card's light sender-HTML
  // sheet), so it's a .email-shell descendant on the always-dark mail palette. Styled against
  // the --mail-* tokens directly (app/globals.css) rather than light-palette hex literals — the
  // shell's remap only covers a fixed list of legacy hex values, and an unlisted one (as this
  // card originally used) renders unconverted, pairing dark-remapped text with a light
  // background. #B98CFF/#F87171 match the lifted brand-purple/red the shell already uses for
  // legibility on this surface (see globals.css's text-[#701CC0] and .email-dialog-dark rules).
  return (
    <div className="mb-4 rounded-xl border border-[var(--mail-border)] bg-[var(--mail-surface-2)] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--mail-brand-tint)] text-[#B98CFF]">
          <FiCalendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--mail-text)]">{invite.summary}</h3>
            {invite.hasRrule ? (
              <span className="rounded-full bg-[var(--mail-surface-3)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--mail-text-muted)]">
                Recurring
              </span>
            ) : null}
            {isCanceled ? (
              <span className="rounded-full bg-[rgba(220,38,38,0.16)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#F87171]">
                Canceled
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--mail-text-muted)]">{formatRange(invite)}</p>
          {invite.location ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--mail-text-muted)]">
              <FiMapPin className="h-3 w-3" /> {invite.location}
            </p>
          ) : null}
          {invite.attendeeEmails.length > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--mail-text-muted)]">
              <FiUsers className="h-3 w-3" /> {invite.attendeeEmails.length} attendee
              {invite.attendeeEmails.length === 1 ? "" : "s"}
            </p>
          ) : null}

          {error ? <p className="mt-2 text-xs text-[#F87171]">{error}</p> : null}

          {showButtons ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["accepted", "tentative", "declined"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={sending !== null}
                  onClick={() => respond(option)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    sending === option
                      ? "border-[#B98CFF] bg-[#B98CFF] text-white"
                      : "border-[#B98CFF] text-[#B98CFF] hover:bg-[var(--mail-brand-tint)] disabled:opacity-50"
                  }`}
                >
                  {sending === option ? "Sending…" : RESPONSE_LABEL[option]}
                </button>
              ))}
            </div>
          ) : !isCanceled && invite.myResponse ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--mail-text)]">
                You responded: {RESPONSE_LABEL[invite.myResponse]}
              </span>
              <button
                type="button"
                onClick={() => setChangingResponse(true)}
                className="text-xs text-[#B98CFF] hover:underline"
              >
                Change response
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
