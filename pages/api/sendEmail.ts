import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmail } from "@/lib/emailSender";

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
