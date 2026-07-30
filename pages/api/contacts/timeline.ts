import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Unified activity timeline for a contact (by email): outbound emails (+ opens/clicks),
 * campaign step sends, and meetings booked — merged and sorted newest-first. Best-effort
 * per source so a missing table (P2021) doesn't break the whole timeline.
 */
type TimelineEvent = { type: string; at: string; label: string; detail?: string };

export default withAuth(
  async (req, res, session) => {
    const email = asStr(req.query.email).trim().toLowerCase();
    if (!email) {
      res.status(400).json({ message: "email is required." });
      return;
    }
    const userId = session.user.id;
    const companyId = session.companyId;
    const events: TimelineEvent[] = [];

    // Outbound emails + their tracking events.
    try {
      const outbound = await prisma.emailOutboundMessage.findMany({
        where: { user_id: userId, email_outbound_recipients: { some: { email } } },
        orderBy: { created_at: "desc" },
        take: 50,
        select: {
          subject: true,
          created_at: true,
          email_tracking_events: { select: { event_type: true, occurred_at: true }, orderBy: { occurred_at: "asc" }, take: 30 },
        },
      });
      for (const m of outbound) {
        events.push({ type: "sent", at: m.created_at.toISOString(), label: "Email sent", detail: m.subject || "(no subject)" });
        for (const ev of m.email_tracking_events) {
          const t = (ev.event_type || "").toUpperCase();
          events.push({
            type: t === "CLICK" ? "click" : t === "READ" ? "read" : "open",
            at: ev.occurred_at.toISOString(),
            label: t === "CLICK" ? "Link clicked" : t === "READ" ? "Read receipt" : "Email opened",
            detail: m.subject || undefined,
          });
        }
      }
    } catch {
      /* skip */
    }

    // Campaign step sends.
    try {
      const sends = await prisma.campaignStepSend.findMany({
        where: { campaign_contacts: { contact_email: email, campaigns: { company_id: companyId } } },
        orderBy: { created_at: "desc" },
        take: 50,
        select: { status: true, sent_at: true, created_at: true, rendered_subject: true },
      });
      for (const s of sends) {
        events.push({
          type: "campaign",
          at: (s.sent_at || s.created_at).toISOString(),
          label: s.status === "sent" ? "Campaign email sent" : `Campaign step (${s.status})`,
          detail: s.rendered_subject || undefined,
        });
      }
    } catch {
      /* skip */
    }

    // Meetings booked.
    try {
      const bookings = await prisma.booking.findMany({
        where: { invitee_email: email, booking_links: { user_id: userId } },
        orderBy: { created_at: "desc" },
        take: 25,
        select: { start_at: true, created_at: true, status: true, booking_links: { select: { title: true } } },
      });
      for (const b of bookings) {
        events.push({
          type: "booking",
          at: b.created_at.toISOString(),
          label: b.status === "confirmed" ? "Meeting booked" : `Meeting ${b.status}`,
          detail: `${b.booking_links.title} — ${b.start_at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
        });
      }
    } catch {
      /* skip */
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    res.status(200).json({ email, events: events.slice(0, 150) });
  },
  { methods: ["GET"] }
);
