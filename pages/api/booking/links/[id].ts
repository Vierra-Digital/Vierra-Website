import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/** Delete one of the caller's own booking links. */
export default withAuth(
  async (req, res, session) => {
    const id = asStr(req.query.id).trim();
    const link = await prisma.bookingLink.findUnique({ where: { id }, select: { user_id: true } });
    if (!link || link.user_id !== session.user.id) {
      res.status(404).json({ message: "Booking link not found." });
      return;
    }

    try {
      await prisma.bookingLink.delete({ where: { id } });
    } catch (e) {
      // FK violation — bookings still reference this link.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        res.status(409).json({ message: "This link has existing bookings and can't be deleted." });
        return;
      }
      throw e;
    }
    res.status(200).json({ ok: true });
  },
  { methods: ["DELETE"] }
);
