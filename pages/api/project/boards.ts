import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canAccessBoard, BOARDS } from "@/lib/projectBoards";

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

  const userId = (session.user as any)?.id;
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: parseInt(String(userId), 10) },
        select: { position: true },
      })
    : await prisma.user.findUnique({
        where: { email: (session.user as any)?.email },
        select: { position: true },
      });
  const position = user?.position ?? null;

  const allowedBoards = BOARDS.filter((b) => canAccessBoard(position, b));
  return res.status(200).json({ boards: allowedBoards });
}
