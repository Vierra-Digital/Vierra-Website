import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(async (req, res, session) => {
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

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ message: "Method Not Allowed" });
}, { methods: ["GET", "POST"], roles: ["admin", "staff"] });
