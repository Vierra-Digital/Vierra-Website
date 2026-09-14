import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";
import { DEFAULT_BOARD_NAMES } from "@/lib/projectBoards";

/**
 * Read-only. Boards are the four teams seeded on first read (lib/projectBoards.ts); creating more
 * from the panel is how the original fixed set turned into a free-for-all, and left companies
 * with a "New board" box as their entire empty state.
 */
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

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({ message: "Method Not Allowed" });
}, { methods: ["GET"], roles: ["admin", "staff"] });
