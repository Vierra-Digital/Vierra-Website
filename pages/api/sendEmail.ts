import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmail } from "@/lib/emailSender";
import { normalizeAuditSubmission } from "@/lib/publicFormValidation";
import { asStr } from "@/lib/api/parsing";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

// Internal lead-notification only. The audit-call modal (components/Modal.tsx) intentionally
// never gets a "you're confirmed" email from this endpoint — that confirmation only exists
// once a real Booking is created (the booking API's own confirmation email), since a step-2
// submit with no follow-through to step 3 isn't a booked meeting.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const ip = getClientIp(req);
  if (!checkRateLimit(`audit-submit:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return res.status(429).json({ message: "Too many submissions. Please try again later." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Bots that fill every field see the same success response as a real user,
  // but no email or confirmation is sent.
  if (asStr(body.company)) {
    return res.status(200).json({ message: "Email sent successfully!" });
  }

  const submission = normalizeAuditSubmission(body);
  if (!submission) {
    return res.status(400).json({ message: "Invalid form submission." });
  }

  try {
    await sendEmail(submission);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Audit email submission failed:", error);
    res.status(500).json({ message: "Failed to send email." });
  }
}
