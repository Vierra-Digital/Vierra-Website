import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { asStr } from "@/lib/api/parsing";
import { rescheduleBooking } from "@/lib/booking/reschedule";

/** Public, prospect-initiated reschedule. Email match is the second factor alongside the id capability token. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }
  const id = asStr(req.query.id).trim();
  const inviteeEmail = asStr(req.body?.inviteeEmail).trim().toLowerCase();
  const newStartIso = asStr(req.body?.newStart).trim();

  const booking = await prisma.booking.findUnique({ where: { id }, select: { invitee_email: true } });
  if (!booking || booking.invitee_email !== inviteeEmail) {
    res.status(404).json({ message: "Not found." });
    return;
  }

  const result = await rescheduleBooking(id, new Date(newStartIso), "prospect");
  if (!result.ok) {
    res.status(409).json({ message: result.message });
    return;
  }
  res.status(200).json({ ok: true });
}
