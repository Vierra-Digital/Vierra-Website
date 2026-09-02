import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { safeCompare } from "@/lib/crypto";
import { findFreeCompanyMembers } from "@/lib/booking/teamAvailability";
import { claimBookingSlot } from "@/lib/booking/claimSlot";

/**
 * Cron dispatch for the round-robin auto-assign fallback (MEETING_TRACKING_QUESTIONS.md §32/§34/
 * §37/§39): if a team-link slot sits unclaimed 12 hours after the prospect claimed it, assign it
 * to whichever free company member has claimed the fewest meetings historically (simple fairness
 * proxy — least-loaded, not a strict rotation queue). Runs every few minutes so the "12 hours"
 * deadline and any availability change (someone else gets booked, frees up, etc.) both get
 * picked up promptly, not just at a single fixed check — see the `auto-assign-meetings` pg_cron
 * job in prisma/manual/20260901_migrate_cron_to_pg_cron.sql.
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
    where: { status: "slot_claimed", claim_deadline_at: { lte: new Date() } },
    select: { id: true, start_at: true, end_at: true, booking_links: { select: { company_id: true } } },
    take: 100,
  });

  const totals = { checked: due.length, assigned: 0, stillNoneFree: 0 };
  for (const booking of due) {
    const companyId = booking.booking_links.company_id;
    if (!companyId) continue;
    const free = await findFreeCompanyMembers(companyId, booking.start_at.toISOString(), booking.end_at.toISOString());
    if (free.length === 0) {
      totals.stillNoneFree += 1;
      continue; // stays in the queue; next tick (or a member manually claiming) will pick it up
    }
    const claimCounts = await prisma.booking.groupBy({
      by: ["claimed_by_user_id"],
      where: { claimed_by_user_id: { in: free } },
      _count: { claimed_by_user_id: true },
    });
    const countByUser = new Map(claimCounts.map((c) => [c.claimed_by_user_id as string, c._count.claimed_by_user_id]));
    const winner = [...free].sort((a, b) => (countByUser.get(a) || 0) - (countByUser.get(b) || 0))[0];
    const result = await claimBookingSlot(booking.id, winner).catch(() => ({ ok: false as const, reason: "provisioning_failed" as const }));
    if (result.ok) totals.assigned += 1;
  }

  res.status(200).json(totals);
}
