import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const sessionsFile = path.join(process.cwd(), "sessions.json");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // Read sessions file
    if (!fs.existsSync(sessionsFile)) {
      return res.status(200).json([]);
    }

    const fileContent = fs.readFileSync(sessionsFile, "utf-8");
    const sessions = JSON.parse(fileContent);

    // Convert sessions object to array with summary information
    const sessionList = Object.values(sessions).map((session: any) => ({
      token: session.token,
      clientName: session.clientName,
      clientEmail: session.clientEmail,
      businessName: session.businessName,
      createdAt: session.createdAt,
      submittedAt: session.submittedAt || null,
      status: session.status || "pending",
      hasAnswers: !!session.answers
    }));

    // Sort by creation date (newest first)
    sessionList.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json(sessionList);
  } catch (error) {
    console.error("Error reading sessions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
