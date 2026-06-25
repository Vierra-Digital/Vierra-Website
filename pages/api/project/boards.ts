import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  if (req.method === "GET") {
    try {
      const boards = await prisma.projectBoard.findMany({
        where: { company_id: session.companyId },
        orderBy: { created_at: "asc" },
        select: { id: true, name: true },
      });
      return res.status(200).json(boards);
    } catch (e) {
      console.error("project/boards GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "POST") {
    if (session.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create boards" });
    }
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name is required" });
    }
    try {
      const board = await prisma.projectBoard.create({
        data: { company_id: session.companyId, name: name.trim() },
        select: { id: true, name: true },
      });
      return res.status(201).json(board);
    } catch (e) {
      console.error("project/boards POST", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
