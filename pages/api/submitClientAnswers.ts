import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const sessionsFile = path.join(process.cwd(), "sessions.json");

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const { token, answers, completed } = req.body;
  if (!token || !answers) {
    return res.status(400).json({ message: "Missing token or answers" });
  }
  try {
    if (!fs.existsSync(sessionsFile)) {
      return res.status(404).json({ message: "Session not found" });
    }
    const fileContent = fs.readFileSync(sessionsFile, "utf-8");
    const sessions = JSON.parse(fileContent);
    if (!sessions[token]) {
      return res.status(404).json({ message: "Session not found" });
    }
    const updateData: any = {
      ...sessions[token],
      answers,
      lastUpdatedAt: Date.now()
    };
    if (completed) {
      updateData.submittedAt = Date.now();
      updateData.status = "completed";
    }
    sessions[token] = updateData;
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
    res.status(200).json({ message: "Answers saved successfully" });
  } catch (error) {
    console.error("Error saving answers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
