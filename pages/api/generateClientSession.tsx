import { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// Store sessions in a JSON file for demo purposes
const SESSIONS_PATH = path.resolve(process.cwd(), "client_sessions.json");

function saveClientSession(token: string, data: any) {
  let sessions: { [key: string]: any } = {};
  if (fs.existsSync(SESSIONS_PATH)) {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf-8"));
  }
  sessions[token] = data;
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  const { clientName, clientAddress, businessName } = req.body;
  if (!clientName || !clientAddress || !businessName) {
    return res.status(400).json({ message: "Missing fields" });
  }
  const token = uuidv4();
  saveClientSession(token, { clientName, clientAddress, businessName, createdAt: Date.now() });
  res.status(200).json({ link: `/session/${token}` });
}