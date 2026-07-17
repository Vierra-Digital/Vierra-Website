import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { gmailGet } from "@/lib/gmail/gmailApi";
import type { InboundMessage, InboundContext } from "@/lib/gmail/inboundTypes";
import {
  applyFilters,
  maybeSendVacationReply,
  maybeAutoDraft,
  maybeHandleMdn,
  maybeReplyIntelligence,
  maybeNotifyDiscord,
} from "@/lib/gmail/inboundActions";

/**
 * Inbound-processing loop. Polls each connected Gmail account via the Users.history API,
 * tracking a per-(user,account) historyId cursor (GmailInboxSyncState). For every newly
 * added message it runs the inbound hooks (filters, vacation reply, auto-draft, MDN).
 *
 * Polling (not Pub/Sub push) is deliberate: it needs no external Pub/Sub topic / domain
 * verification and runs on the same Netlify cron as scheduled send. The first sync for an
 * account only records a baseline historyId (no retroactive processing).
 */

/** Cap messages processed per account per tick so one busy inbox can't stall the loop. */
const MAX_MESSAGES_PER_ACCOUNT = 25;

export type InboundSummary = { accounts: number; processed: number; errors: number };

function parseEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] || raw).trim().toLowerCase();
}

function headerMap(headers: Array<{ name?: string; value?: string }> | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers || []) {
    if (h.name) map[h.name.toLowerCase()] = h.value || "";
  }
  return map;
}

type HistoryResponse = {
  history?: Array<{ messagesAdded?: Array<{ message?: { id?: string; threadId?: string; labelIds?: string[] } }> }>;
  historyId?: string;
  nextPageToken?: string;
};

async function fetchInboundMessage(
  accessToken: string,
  userId: string,
  accountEmail: string,
  id: string
): Promise<InboundMessage | null> {
  const { ok, data } = await gmailGet(
    accessToken,
    `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=Content-Type&metadataHeaders=Auto-Submitted`
  );
  if (!ok || !data || typeof data !== "object") return null;
  const msg = data as {
    id?: string;
    threadId?: string;
    snippet?: string;
    labelIds?: string[];
    payload?: { headers?: Array<{ name?: string; value?: string }> };
  };
  const headers = headerMap(msg.payload?.headers);
  const from = headers["from"] || "";
  return {
    id: msg.id || id,
    threadId: msg.threadId || "",
    userId,
    accountEmail,
    from,
    fromEmail: parseEmail(from),
    to: headers["to"] || "",
    subject: headers["subject"] || "",
    snippet: msg.snippet || "",
    labelIds: Array.isArray(msg.labelIds) ? msg.labelIds : [],
    messageIdHeader: headers["message-id"] || "",
    inReplyTo: headers["in-reply-to"] || "",
    headers,
  };
}

async function processAccount(
  userId: string,
  accountEmail: string,
  baseUrl: string,
  now: Date
): Promise<{ processed: number; error: boolean }> {
  const token = await getValidGmailAccessToken(userId, accountEmail);
  if (!token.ok) return { processed: 0, error: true };
  const accessToken = token.accessToken;

  const state = await prisma.gmailInboxSyncState.findUnique({
    where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
  });

  // No cursor yet: record the current historyId as a baseline (don't backfill history).
  if (!state?.history_id) {
    const profile = await gmailGet(accessToken, "/profile");
    const historyId = profile.ok ? String((profile.data as { historyId?: string })?.historyId || "") : "";
    await prisma.gmailInboxSyncState.upsert({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
      create: { user_id: userId, account_email: accountEmail, history_id: historyId || null, last_sync_at: now, last_status: "baseline" },
      update: { history_id: historyId || null, last_sync_at: now, last_status: "baseline", updated_at: now },
    });
    return { processed: 0, error: !profile.ok };
  }

  // List history since the stored cursor.
  const { ok, data } = await gmailGet(
    accessToken,
    `/history?startHistoryId=${encodeURIComponent(state.history_id)}&historyTypes=messageAdded`
  );
  if (!ok) {
    // 404 => historyId too old/expired; reset baseline so we recover next tick.
    const profile = await gmailGet(accessToken, "/profile");
    const historyId = profile.ok ? String((profile.data as { historyId?: string })?.historyId || "") : state.history_id;
    await prisma.gmailInboxSyncState.update({
      where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
      data: { history_id: historyId, last_sync_at: now, last_status: "reset", updated_at: now },
    });
    return { processed: 0, error: true };
  }

  const history = data as HistoryResponse;
  const newestHistoryId = history.historyId || state.history_id;

  // Collect unique newly-added message ids that are inbound (skip SENT/DRAFT).
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const h of history.history || []) {
    for (const added of h.messagesAdded || []) {
      const m = added.message;
      if (!m?.id) continue;
      const labels = m.labelIds || [];
      if (labels.includes("SENT") || labels.includes("DRAFT")) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      ids.push(m.id);
      if (ids.length >= MAX_MESSAGES_PER_ACCOUNT) break;
    }
    if (ids.length >= MAX_MESSAGES_PER_ACCOUNT) break;
  }

  const ctx: InboundContext = { accessToken, baseUrl, now };
  let processed = 0;
  for (const id of ids) {
    const message = await fetchInboundMessage(accessToken, userId, accountEmail, id);
    if (!message) continue;
    // Each hook is best-effort and must not throw; guard anyway.
    for (const hook of [applyFilters, maybeSendVacationReply, maybeAutoDraft, maybeHandleMdn, maybeReplyIntelligence, maybeNotifyDiscord]) {
      try {
        await hook(message, ctx);
      } catch {
        /* one hook failing must not block the others or the loop */
      }
    }
    processed += 1;
  }

  await prisma.gmailInboxSyncState.update({
    where: { user_id_account_email: { user_id: userId, account_email: accountEmail } },
    data: { history_id: newestHistoryId, last_sync_at: now, last_status: "ok", updated_at: now },
  });

  return { processed, error: false };
}

/** Poll and process inbound mail for every connected Gmail account across all users. */
export async function processInboundForAllAccounts(baseUrl: string, now: Date): Promise<InboundSummary> {
  const tokens = await prisma.platformToken.findMany({
    where: { platform: { startsWith: "gmail:" } },
    select: { user_id: true, platform: true },
  });

  const summary: InboundSummary = { accounts: 0, processed: 0, errors: 0 };
  for (const row of tokens) {
    const accountEmail = row.platform.replace(/^gmail:/, "").toLowerCase();
    if (!accountEmail) continue;
    summary.accounts += 1;
    try {
      const result = await processAccount(row.user_id, accountEmail, baseUrl, now);
      summary.processed += result.processed;
      if (result.error) summary.errors += 1;
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
