import { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const sessionsFile = path.join(process.cwd(), "sessions.json");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { clientName, clientEmail, businessName } = req.body;
  if (!clientName || !clientEmail || !businessName) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const token = uuidv4();
  const sessionData = { clientName, clientEmail, businessName, token, createdAt: Date.now() };

  // Read existing sessions or initialize
  let sessions: Record<string, any> = {};
  if (fs.existsSync(sessionsFile)) {
    const fileContent = fs.readFileSync(sessionsFile, "utf-8");
    try {
      sessions = JSON.parse(fileContent);
    } catch {
      sessions = {};
    }
  }

  // Add new session
  sessions[token] = sessionData;

  // Write back to file
  fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

  res.status(200).json({ link: `/session/${token}` });
}