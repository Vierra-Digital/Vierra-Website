import { prisma } from "@/lib/prisma";
import { sendEmailCore, type SendEmailPayload } from "@/lib/gmail/sendCore";
import type { Prisma } from "@prisma/client";

/**
 * Scheduled send — persisted queue dispatched by a cron worker (Netlify Scheduled
 * Function). Deliberately NOT a browser timer: the message is stored and sent
 * server-side at the chosen time even if the user has closed the tab.
 */

/** How far ahead a send may be scheduled. */
export const MAX_SCHEDULE_DAYS = 60;
/** How many delivery attempts before a queued send is marked FAILED. */
const MAX_ATTEMPTS = 3;
/** Safety cap on how many due messages one dispatch tick processes. */
const DISPATCH_BATCH = 25;
/** A row claimed as SENDING but not resolved within this window is treated as a crashed worker. */
const STALE_SENDING_MS = 10 * 60 * 1000;

export type ScheduleParseResult =
  | { ok: true; date: Date }
  | { ok: false; message: string };

/**
 * Validate a client-supplied scheduled-at value. Returns the parsed Date only if
 * it is a real time comfortably in the future and within the allowed window.
 * `now` is injected so callers/tests aren't tied to the wall clock.
 */
export function parseScheduledAt(raw: unknown, now: Date): ScheduleParseResult {
  if (raw == null || raw === "") return { ok: false, message: "No schedule time provided." };
  const date = new Date(typeof raw === "number" ? raw : String(raw));
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Invalid schedule time." };
  // Require at least a minute out so it doesn't race the current dispatch tick.
  if (date.getTime() <= now.getTime() + 60_000) {
    return { ok: false, message: "Schedule time must be at least a minute in the future." };
  }
  const maxMs = now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
  if (date.getTime() > maxMs) {
    return { ok: false, message: `Schedule time can be at most ${MAX_SCHEDULE_DAYS} days out.` };
  }
  return { ok: true, date };
}

/** Persist a compose payload to send later. Returns the queued row's id + time. */
export async function enqueueScheduledSend(
  userId: string,
  accountEmail: string,
  payload: SendEmailPayload,
  scheduledAt: Date
): Promise<{ id: string; scheduledAt: string }> {
  const row = await prisma.emailScheduledSend.create({
    data: {
      user_id: userId,
      account_email: accountEmail,
      scheduled_at: scheduledAt,
      status: "PENDING",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, scheduled_at: true },
  });
  return { id: row.id, scheduledAt: row.scheduled_at.toISOString() };
}

export type DispatchSummary = { processed: number; sent: number; failed: number };

/**
 * Send every PENDING message whose time has come. Called by the cron dispatcher.
 * Each message is claimed (status → SENDING) before delivery so overlapping ticks
 * don't double-send. `now` is injected for testability.
 */
export async function dispatchDueScheduledSends(baseUrl: string, now: Date): Promise<DispatchSummary> {
  // Reclaim rows orphaned in SENDING (worker crashed/OOM'd/redeployed after claiming but
  // before resolving): return them to PENDING for retry, or FAIL them once attempts are spent.
  // Without this a stuck row would never be retried (the query below only selects PENDING).
  const staleBefore = new Date(now.getTime() - STALE_SENDING_MS);
  await prisma.emailScheduledSend.updateMany({
    where: { status: "SENDING", updated_at: { lt: staleBefore }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "PENDING", updated_at: now },
  });
  await prisma.emailScheduledSend.updateMany({
    where: { status: "SENDING", updated_at: { lt: staleBefore }, attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "FAILED", last_error: "Timed out while sending.", updated_at: now },
  });

  const due = await prisma.emailScheduledSend.findMany({
    where: { status: "PENDING", scheduled_at: { lte: now } },
    orderBy: { scheduled_at: "asc" },
    take: DISPATCH_BATCH,
  });

  const summary: DispatchSummary = { processed: 0, sent: 0, failed: 0 };

  for (const row of due) {
    // Claim this row so a concurrent tick can't grab it (optimistic: only if still PENDING).
    const claimed = await prisma.emailScheduledSend.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 }, updated_at: now },
    });
    if (claimed.count === 0) continue;
    summary.processed += 1;

    const payload = row.payload as unknown as SendEmailPayload;
    let result: Awaited<ReturnType<typeof sendEmailCore>>;
    try {
      result = await sendEmailCore(row.user_id, { ...payload, accountEmail: row.account_email }, baseUrl);
    } catch (error) {
      result = { ok: false, status: 500, message: error instanceof Error ? error.message : "Send crashed." };
    }

    if (result.ok) {
      summary.sent += 1;
      await prisma.emailScheduledSend.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sent_at: now,
          outbound_message_id: result.outboundId,
          last_error: null,
          updated_at: now,
        },
      });
    } else {
      // Retry a few times (back to PENDING) before giving up; 4xx are permanent.
      const permanent = result.status >= 400 && result.status < 500;
      const giveUp = permanent || row.attempts + 1 >= MAX_ATTEMPTS;
      summary.failed += 1;
      await prisma.emailScheduledSend.update({
        where: { id: row.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          last_error: result.message.slice(0, 500),
          updated_at: now,
        },
      });
    }
  }

  return summary;
}
