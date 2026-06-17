import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { canAccessBoard, BOARDS } from "@/lib/projectBoards";
import { getSessionPosition } from "@/lib/api/projectAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  const role = (session.user as { role?: string })?.role;

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
