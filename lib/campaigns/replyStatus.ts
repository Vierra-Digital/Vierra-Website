import { LEAD_STATUSES, type LeadStatus } from "@/lib/api/campaigns";

/**
 * What an inbound reply does to a campaign contact's lead status.
 *
 * Two decisions, both previously inline in lib/gmail/inboundActions.ts:
 *
 *  1. Turning the classifier's label into a canonical status. The map used to be typed
 *     `Record<string, string>`, so nothing checked the values — and it shipped writing
 *     "interested" and "unsubscribed", neither of which is in LEAD_STATUSES. The rows were
 *     written, no error was raised, and the replies simply never matched the panel's status
 *     filters. Typing the values as LeadStatus makes that a compile error rather than something
 *     to notice later.
 *
 *  2. Not downgrading a status that already carries signal. isAutomatedSender() only inspects
 *     headers, so a genuine human reply whose body reads like an out-of-office note ("swamped
 *     this week, will follow up Monday", sent from a normal inbox) reaches here and classifies as
 *     no_response. Applied blindly that would erase an existing positive_response or
 *     meeting_booked.
 */

/**
 * The labels the classifier is asked for, mapped to the statuses the rest of the app uses.
 *
 * Keys are the classifier's vocabulary and are deliberately not LeadStatus — they are what the
 * prompt asks for, and the two vocabularies are allowed to differ. The values are constrained.
 */
export const REPLY_LABEL_TO_LEAD_STATUS: Readonly<Record<string, LeadStatus>> = {
  interested: "positive_response",
  not_interested: "not_interested",
  out_of_office: "no_response",
  unsubscribe: "remove_contact",
  neutral: "reply",
};

/**
 * Statuses a no_response classification must not overwrite. Each represents a human decision or a
 * booked outcome; "reply" and "follow_up" are absent because they carry no more information than
 * no_response does.
 */
export const STICKY_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "positive_response",
  "positive_response_closed",
  "meeting_booked",
  "not_interested",
  "remove_contact",
  "bad_timing",
]);

/** A reply with no usable classification still pauses the sequence, so it needs a status. */
export const DEFAULT_REPLY_LEAD_STATUS: LeadStatus = "reply";

/**
 * Normalise whatever the model returned before looking it up. It is asked for a bare label but is
 * free to add punctuation, quotes, whitespace or capitals, and a near-miss should not silently
 * become "no classification".
 */
export function normalizeReplyLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z_]/g, "");
}

/** The canonical status for a classifier label, or null when the label is not one we know. */
export function leadStatusFromReplyLabel(raw: string): LeadStatus | null {
  return REPLY_LABEL_TO_LEAD_STATUS[normalizeReplyLabel(raw)] ?? null;
}

/**
 * The status an inbound reply should leave the contact on.
 *
 * `currentStatus` comes from the database as a plain string, so it is accepted as one and checked
 * against the sticky set rather than trusted to be a LeadStatus.
 */
export function resolveReplyLeadStatus(
  rawLabel: string | null | undefined,
  currentStatus: string | null | undefined
): LeadStatus {
  const mapped = rawLabel ? leadStatusFromReplyLabel(rawLabel) : null;
  const next = mapped ?? DEFAULT_REPLY_LEAD_STATUS;

  if (next === "no_response" && currentStatus && STICKY_LEAD_STATUSES.has(currentStatus as LeadStatus)) {
    return currentStatus as LeadStatus;
  }
  return next;
}

/** Whether a string is one of the canonical lead statuses. */
export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
