import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";
import { DEFAULT_BOARD_NAMES } from "@/lib/projectBoards";

export default withAuth(async (req, res, session) => {
  // A staff member who has not picked a client works on their own company's boards rather than
  // being refused, the same as the dashboard. A client session always resolves to its own company.
  const companyId = resolveTargetCompanyId(session, req) ?? session.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (req.method === "GET") {
    try {
      const boards = await prisma.projectBoard.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "asc" },
        select: { id: true, name: true },
      });
      if (boards.length > 0) return res.status(200).json(boards);

      /**
       * Seeded on first read, not by a migration: boards are per company, and companies are
       * created continuously, so there is no single moment a migration could have run. skipDuplicates
       * makes two simultaneous first reads safe — the loser inserts nothing rather than erroring.
       */
      await prisma.projectBoard.createMany({
        data: DEFAULT_BOARD_NAMES.map((name) => ({ company_id: companyId, name })),
        skipDuplicates: true,
      });
      const seeded = await prisma.projectBoard.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "asc" },
        select: { id: true, name: true },
      });
      return res.status(200).json(seeded);
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
        data: { company_id: companyId, name: name.trim() },
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
