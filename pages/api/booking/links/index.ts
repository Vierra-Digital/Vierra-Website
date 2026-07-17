import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { DEFAULT_AVAILABILITY } from "@/lib/booking/slots";
import type { Prisma } from "@prisma/client";

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "meeting";
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

/** List / create the caller's meeting booking links. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const links = await prisma.bookingLink.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
      });
      res.status(200).json({ links });
      return;
    }

    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const title = asStr(req.body?.title).trim();
    if (!accountEmail || !title) {
      res.status(400).json({ message: "accountEmail and title are required." });
      return;
    }
    const durationRaw = Number(req.body?.durationMinutes);
    const bufferRaw = Number(req.body?.bufferMinutes);
    const link = await prisma.bookingLink.create({
      data: {
        user_id: userId,
        account_email: accountEmail,
        slug: slugify(title),
        title,
        description: asStr(req.body?.description).trim() || null,
        duration_minutes: Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(Math.floor(durationRaw), 480) : 30,
        buffer_minutes: Number.isFinite(bufferRaw) && bufferRaw >= 0 ? Math.min(Math.floor(bufferRaw), 240) : 0,
        timezone: asStr(req.body?.timezone).trim() || "UTC",
        availability: (req.body?.availability as Prisma.InputJsonValue) ?? (DEFAULT_AVAILABILITY as unknown as Prisma.InputJsonValue),
      },
    });
    res.status(200).json({ link });
  },
  { methods: ["GET", "POST"] }
);
