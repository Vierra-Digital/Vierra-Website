import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { syncBookingAttendance } from "@/lib/booking/syncAttendance";

/**
 * Cron dispatch endpoint for the attendance-sync reconciliation poll (hourly). CRON_SECRET-
 * protected, same shape as campaigns/send-queue/dispatch. Finds bookings that ended but are
 * still sitting at attendance_status='booked', and syncs each in-process (not via N HTTP
 * round-trips) — this is the backstop referenced in the implementation plan/§6/§39; push
 * webhooks (Phase 2) fire sooner, this just guarantees nothing is stuck forever.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  const secret = process.env.CRON_SECRET || "";
  const provided =
    (typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "") ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!secret || !safeCompare(provided, secret)) {
    res.status(401).json({ message: "Unauthorized." });
    return;
  }

  const due = await prisma.booking.findMany({
    where: { attendance_status: "booked", end_at: { lt: new Date() } },
    select: { id: true },
    take: 200, // safety cap per tick — an hourly cadence easily clears normal volume
  });

  const totals = { checked: due.length, held: 0, not_held: 0, no_data: 0, skipped: 0 };
  for (const { id } of due) {
    const result = await syncBookingAttendance(id).catch(() => "skipped" as const);
    totals[result] += 1;
  }

  res.status(200).json(totals);
}
