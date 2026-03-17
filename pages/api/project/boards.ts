import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { canAccessBoard, BOARDS } from "@/lib/projectBoards";
import { getSessionPosition } from "@/lib/api/projectAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin" && role !== "staff") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (role === "admin") {
    return res.status(200).json({ boards: ["Design", "Development", "Outreach", "Leadership"] });
  }

  const position = await getSessionPosition(session);

  const allowedBoards = BOARDS.filter((b) => canAccessBoard(position, b));
  return res.status(200).json({ boards: allowedBoards });
}
