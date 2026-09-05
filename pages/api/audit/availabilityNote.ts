import type { NextApiRequest, NextApiResponse } from "next";
import { sendAuditAvailabilityNoteEmail } from "@/lib/emailSender";
import { isValidEmail } from "@/lib/utils";
import { asStr } from "@/lib/api/parsing";

const MAX_NOTE_LENGTH = 2000;

/**
 * Fallback for AuditBookingStep when the audit-call calendar has no open slots: sends the
 * lead's freeform availability to sales instead of leaving them stuck on an empty calendar.
 * No database write — everything here is a plain values-object passed straight to nodemailer/
 * Brevo, and the note is HTML-escaped before it ever reaches an email body (see
 * sendAuditAvailabilityNoteEmail) — there's no SQL (or other query-string building) anywhere
 * in this path for user input to inject into.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const fullName = asStr(req.body?.fullName).trim();
  const email = asStr(req.body?.email).trim();
  const note = asStr(req.body?.note).trim();
  const context = asStr(req.body?.context).trim();

  if (!fullName || !email || !isValidEmail(email)) {
    return res.status(400).json({ message: "Missing or invalid name/email." });
  }
  if (!note) {
    return res.status(400).json({ message: "Let us know what times work for you." });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ message: "That note is too long — please keep it under 2000 characters." });
  }

  try {
    await sendAuditAvailabilityNoteEmail({ fullName, email, note, context: context || undefined });
    return res.status(200).json({ message: "Note sent." });
  } catch (error) {
    console.error("Error sending availability note:", error);
    return res.status(500).json({ message: "Failed to send. Please try again." });
  }
}
