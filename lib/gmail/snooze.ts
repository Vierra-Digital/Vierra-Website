import { prisma } from "@/lib/prisma";
import { getValidGmailAccessToken } from "@/lib/gmail/tokens";
import { getOrCreateLabelId, modifyMessageLabels } from "@/lib/gmail/gmailApi";
import { resolveMailboxOwner } from "@/lib/email/mailboxAccess";

/**
 * Snooze: hide a message from the inbox until a chosen time, then re-surface it.
 * Implemented with a "Snoozed" Gmail label (remove INBOX + add Snoozed) and a persisted
 * EmailSnooze row. The inbound cron calls resurfaceDueSnoozes() to bring due ones back.
 */

const SNOOZE_LABEL = "Snoozed";

export type SnoozeItem = { messageId: string; threadId?: string };

export async function snoozeMessages(
  userId: string,
  accountEmail: string,
  items: SnoozeItem[],
  until: Date
): Promise<{ ok: boolean; snoozed: number; message?: string }> {
  // accountEmail may be a Gmail "send as" alias, which has no OAuth token of its own — resolve
  // back to the real Gmail address that holds one (a no-op for a directly-connected account).
  const access = await resolveMailboxOwner(userId, accountEmail);
  const tokenEmail = access?.tokenEmail || accountEmail;
  const token = await getValidGmailAccessToken(userId, tokenEmail);
  if (!token.ok) return { ok: false, snoozed: 0, message: token.message };
  const labelId = await getOrCreateLabelId(token.accessToken, SNOOZE_LABEL);

  let snoozed = 0;
  for (const item of items) {
    if (!item.messageId) continue;
    await modifyMessageLabels(token.accessToken, item.messageId, {
      addLabelIds: labelId ? [labelId] : [],
      removeLabelIds: ["INBOX"],
    });
    await prisma.emailSnooze.create({
      data: {
        user_id: userId,
        account_email: accountEmail,
        message_id: item.messageId,
        thread_id: item.threadId || null,
        snooze_until: until,
        status: "SNOOZED",
      },
    });
    snoozed += 1;
  }
  return { ok: true, snoozed };
}

/** Restore a single snoozed message to the inbox now (cancel the snooze). */
export async function unsnooze(userId: string, id: string): Promise<boolean> {
  const row = await prisma.emailSnooze.findFirst({ where: { id, user_id: userId, status: "SNOOZED" } });
  if (!row) return false;
  const access = await resolveMailboxOwner(userId, row.account_email);
  const tokenEmail = access?.tokenEmail || row.account_email;
  const token = await getValidGmailAccessToken(userId, tokenEmail);
  if (token.ok) {
    const labelId = await getOrCreateLabelId(token.accessToken, SNOOZE_LABEL);
    await modifyMessageLabels(token.accessToken, row.message_id, {
      addLabelIds: ["INBOX", "UNREAD"],
      removeLabelIds: labelId ? [labelId] : [],
    });
  }
  await prisma.emailSnooze.update({ where: { id: row.id }, data: { status: "CANCELED", updated_at: new Date() } });
  return true;
}

/** Bring back every snoozed message whose time has come. Called by the inbound cron. */
export async function resurfaceDueSnoozes(now: Date): Promise<{ resurfaced: number }> {
  const due = await prisma.emailSnooze.findMany({
    where: { status: "SNOOZED", snooze_until: { lte: now } },
    orderBy: { snooze_until: "asc" },
    take: 100,
  });
  if (due.length === 0) return { resurfaced: 0 };

  // Group by (user, account) to reuse one token + label lookup per account.
  const groups = new Map<string, { userId: string; accountEmail: string; rows: typeof due }>();
  for (const row of due) {
    const key = `${row.user_id}::${row.account_email}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { userId: row.user_id, accountEmail: row.account_email, rows: [row] });
  }

  let resurfaced = 0;
  for (const group of groups.values()) {
    try {
      const access = await resolveMailboxOwner(group.userId, group.accountEmail);
      const tokenEmail = access?.tokenEmail || group.accountEmail;
      const token = await getValidGmailAccessToken(group.userId, tokenEmail);
      // Token invalid (account disconnected / needs reconnect): leave these rows SNOOZED so a later
      // tick retries once the token recovers, instead of marking them resurfaced while the message
      // is still hidden from the inbox (which would strand it there permanently).
      if (!token.ok) continue;
      const labelId = await getOrCreateLabelId(token.accessToken, SNOOZE_LABEL);
      for (const row of group.rows) {
        try {
          const ok = await modifyMessageLabels(token.accessToken, row.message_id, {
            addLabelIds: ["INBOX", "UNREAD"],
            removeLabelIds: labelId ? [labelId] : [],
          });
          // Only flip to RESURFACED once the message is actually back in the inbox; a failed modify
          // leaves the row SNOOZED to retry rather than losing the message.
          if (!ok) continue;
          await prisma.emailSnooze.update({ where: { id: row.id }, data: { status: "RESURFACED", updated_at: now } });
          resurfaced += 1;
        } catch {
          /* per-row guard: one failure must not abort the batch (or block the rest of the cron) */
        }
      }
    } catch {
      /* per-group guard: a token/label failure for one account must not abort the others */
    }
  }
  return { resurfaced };
}
