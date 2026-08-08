import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Manual GDPR/CCPA erasure-on-request — jumps a booking's meeting PII straight to the erased
 * state ahead of the fixed 1-year window (MEETING_TRACKING_QUESTIONS.md §9/§17/§30). Admin-only.
 */
export default withAuth(
  async (req, res) => {
    const id = asStr(req.query.id).trim();
    const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true } });
    if (!booking) {
      res.status(404).json({ message: "Booking not found." });
      return;
    }
    await prisma.booking.update({
      where: { id },
      data: { invitee_name: "", invitee_email: "", invitee_notes: null, attendee_emails: [], pii_erased_at: new Date() },
    });
    res.status(200).json({ ok: true });
  },
  { methods: ["POST"], roles: ["admin"] }
);
