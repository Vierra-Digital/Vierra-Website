import { withAuth } from "@/lib/api/withAuth";
import { asQueryStr } from "@/lib/api/parsing";
import { prisma } from "@/lib/prisma";

const STATUSES = ["pending", "approved", "rejected", "edited"] as const;
const PAGE_SIZE = 50;

/** The review queue: everything Artemis has drafted for this company, newest first. */
export default withAuth(
  async (req, res, session) => {
    const status = asQueryStr(req.query.status).trim().toLowerCase();
    const kind = asQueryStr(req.query.kind).trim().toLowerCase();

    const items = await prisma.artemisReviewItem.findMany({
      where: {
        company_id: session.companyId,
        ...((STATUSES as readonly string[]).includes(status) ? { status } : {}),
        ...(kind ? { kind } : {}),
      },
      orderBy: { created_at: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        brain_id: true,
        kind: true,
        title: true,
        content: true,
        edited_content: true,
        status: true,
        review_note: true,
        reviewed_at: true,
        created_at: true,
        meta: true,
      },
    });

    const counts = await prisma.artemisReviewItem.groupBy({
      by: ["status"],
      where: { company_id: session.companyId },
      _count: { _all: true },
    });

    res.status(200).json({
      items,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    });
  },
  { methods: ["GET"], roles: ["admin", "staff"], scope: "ai/review" }
);
