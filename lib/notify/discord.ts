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
