/**
 * Post a message to the team Discord via an incoming webhook (env DISCORD_WEBHOOK_URL).
 * Best-effort and a no-op if the webhook isn't configured, so callers never need to guard.
 */
export async function notifyDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL || "";
  if (!url || !content.trim()) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
  } catch {
    /* notifications are best-effort */
  }
}

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  author?: { name: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
};

/**
 * Post a rich embed via the same webhook (used for the reply notification). Best-effort and a
 * no-op when the webhook isn't configured, so callers never need to guard.
 */
export async function notifyDiscordEmbed(embed: DiscordEmbed): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL || "";
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch {
    /* notifications are best-effort */
  }
}

export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

/**
 * Embed color per canonical LEAD_STATUS (lib/api/campaigns.ts), so a positive reply visually
 * stands out from a negative/neutral one at a glance in the channel. Statuses not listed here
 * (reply, no_response, follow_up) fall back to DEFAULT_REPLY_COLOR.
 */
const LEAD_STATUS_DISCORD_COLOR: Record<string, number> = {
  positive_response: 0x22c55e, // green
  positive_response_closed: 0x22c55e,
  meeting_booked: 0x22c55e,
  not_interested: 0xef4444, // red
  remove_contact: 0xef4444,
  bad_timing: 0xf59e0b, // amber
};
const DEFAULT_REPLY_COLOR = 0x701cc0; // Vierra purple

const LEAD_STATUS_EMOJI: Record<string, string> = {
  positive_response: "🟢",
  positive_response_closed: "🟢",
  meeting_booked: "📅",
  not_interested: "🔴",
  remove_contact: "🚫",
  bad_timing: "🟡",
};
const DEFAULT_REPLY_EMOJI = "💬";

export type CampaignReplyNotification = {
  contactEmail: string;
  campaignName: string;
  /** Canonical LEAD_STATUS this reply was classified/updated to. */
  leadStatus: string;
  fromStatus?: string | null;
  subject?: string | null;
  snippet?: string | null;
  threadUrl?: string;
};

/**
 * Shared campaign-aware reply notification, used by both the internal-provider inbound loop
 * (lib/gmail/inboundActions.ts maybeNotifyDiscord) and the Smartlead reply webhook
 * (pages/api/campaigns/webhooks/smartlead.ts), so a reply looks the same in Discord regardless
 * of which provider sent the campaign. Color/emoji are keyed off leadStatus so positive replies
 * (green) are distinguishable from negative (red) and neutral (purple) ones without reading text.
 */
export async function notifyCampaignReply(n: CampaignReplyNotification): Promise<void> {
  const emoji = LEAD_STATUS_EMOJI[n.leadStatus] || DEFAULT_REPLY_EMOJI;
  await notifyDiscordEmbed({
    author: { name: `${emoji} Reply from ${n.contactEmail}`.slice(0, 240) },
    title: (n.subject || "(no subject)").slice(0, 250),
    ...(n.threadUrl ? { url: n.threadUrl } : {}),
    description: n.snippet ? n.snippet.slice(0, 500) : undefined,
    color: LEAD_STATUS_DISCORD_COLOR[n.leadStatus] ?? DEFAULT_REPLY_COLOR,
    fields: [
      { name: "Campaign", value: n.campaignName, inline: true },
      { name: "Status", value: n.fromStatus ? `${n.fromStatus} → ${n.leadStatus}` : n.leadStatus, inline: true },
    ],
  });
}

/** Deep link into the panel for a given campaign/contact — same shape used by every notifier here. */
function panelUrl(path: string): string | undefined {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
}

export type MeetingBookedNotification = {
  contactEmail: string;
  contactName?: string | null;
  campaignId: string;
  campaignName: string;
  contactId: string;
};

/**
 * Shared meeting-booked embed, used by both the automatic booking-confirmation paths
 * (lib/campaigns/meetingBooked.ts) and the manual re-categorization PATCH
 * (pages/api/campaigns/[id]/contacts/[contactId].ts), so the notification looks the same
 * regardless of which path triggered it. Reuses the same green used for a positive
 * lead_status in notifyCampaignReply.
 */
export async function notifyMeetingBooked(n: MeetingBookedNotification): Promise<void> {
  await notifyDiscordEmbed({
    author: { name: `📅 Meeting booked — ${n.contactName || n.contactEmail}`.slice(0, 240) },
    title: n.contactEmail,
    url: panelUrl(`/panel/email?campaign=${n.campaignId}&contact=${n.contactId}`),
    color: LEAD_STATUS_DISCORD_COLOR.meeting_booked,
    fields: [{ name: "Campaign", value: n.campaignName, inline: true }],
  });
}

export type CampaignCompletedNotification = {
  campaignId: string;
  campaignName: string;
  sentCount: number;
  contactCount: number;
};

/** Campaign-completed embed, used by the campaign status PATCH's active -> completed transition. */
export async function notifyCampaignCompleted(n: CampaignCompletedNotification): Promise<void> {
  await notifyDiscordEmbed({
    author: { name: `✅ Campaign completed — ${n.campaignName}`.slice(0, 240) },
    url: panelUrl(`/panel/email?campaign=${n.campaignId}&tab=analytics`),
    description: `${n.sentCount} sent to ${n.contactCount} contacts`,
    color: DEFAULT_REPLY_COLOR,
  });
}

export type CampaignLaunchedNotification = {
  campaignId: string;
  campaignName: string;
  contactCount: number;
};

/** Campaign-launched embed, used by the campaign status PATCH's draft -> active transition (symmetric with notifyCampaignCompleted). */
export async function notifyCampaignLaunched(n: CampaignLaunchedNotification): Promise<void> {
  await notifyDiscordEmbed({
    author: { name: `🚀 Campaign launched — ${n.campaignName}`.slice(0, 240) },
    url: panelUrl(`/panel/email?campaign=${n.campaignId}`),
    description: `${n.contactCount} contact${n.contactCount === 1 ? "" : "s"} enrolled`,
    color: LEAD_STATUS_DISCORD_COLOR.positive_response,
  });
}

export type SignalNotification = {
  contactEmail: string;
  campaignName?: string | null;
  /** "click": a tracked-link click advanced the contact to positive_response.
   *  "enrolled": the same contact was auto-enrolled into a signal nurture sequence. */
  kind: "click" | "enrolled";
  subject?: string | null;
};

/** Shared signals-engine embed (lib/signals/processSignals.ts) for both the high-intent-click and auto-enroll events. */
export async function notifySignal(n: SignalNotification): Promise<void> {
  const isClick = n.kind === "click";
  await notifyDiscordEmbed({
    author: {
      name: (isClick ? `🔥 High-intent signal — ${n.contactEmail}` : `➕ Auto-enrolled — ${n.contactEmail}`).slice(0, 240),
    },
    title: isClick ? n.subject || undefined : undefined,
    description: isClick ? "Clicked a tracked link — marked as a positive response." : "Enrolled into the signal nurture sequence.",
    color: isClick ? LEAD_STATUS_DISCORD_COLOR.positive_response : DEFAULT_REPLY_COLOR,
    fields: n.campaignName ? [{ name: "Campaign", value: n.campaignName, inline: true }] : undefined,
  });
}
