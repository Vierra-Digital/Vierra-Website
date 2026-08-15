import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmail } from "@/lib/emailSender";

// Internal lead-notification only. The audit-call modal (components/Modal.tsx) intentionally
// never gets a "you're confirmed" email from this endpoint — that confirmation only exists
// once a real Booking is created (the booking API's own confirmation email), since a step-2
// submit with no follow-through to step 3 isn't a booked meeting.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  try {
    await sendEmail(req.body);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send email.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
