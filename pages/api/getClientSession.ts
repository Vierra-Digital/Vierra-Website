import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const sessionsFile = path.join(process.cwd(), "sessions.json");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Missing or invalid token" });
  }
  try {
    if (!fs.existsSync(sessionsFile)) {
      return res.status(404).json({ message: "Session not found" });
    }
    const fileContent = fs.readFileSync(sessionsFile, "utf-8");
    const sessions = JSON.parse(fileContent);
    const sessionData = sessions[token];
    if (!sessionData) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!sessionData.firstAccessedAt) {
      const now = Date.now();
      const sessionAge = now - sessionData.createdAt;
      const fiveminutes = 5 * 60 * 1000;
      if (sessionAge > fiveminutes) {
        return res.status(410).json({ message: "Session expired" });
      }
      sessionData.firstAccessedAt = now;
      sessions[token] = sessionData;
      fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
    }
    res.status(200).json(sessionData);
  } catch (error) {
    console.error("Error reading session data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
