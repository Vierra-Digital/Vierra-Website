import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { asQueryStr } from "@/lib/api/parsing";

export type CartographyReviewRow = {
  id: string;
  canEdit: boolean;
  company: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  location: string | null;
  sourceMethod: string;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  status: string;
  runId: string | null;
};

const REVIEWABLE_STATUSES = ["candidate", "reviewed", "promoted"];

/**
 * Cartography's review queue backend (see docs/CARTOGRAPHY_DESIGN.md Rollout M4). Lists
 * cartography_contacts rows a staff member still needs to act on — accept, edit, reject, or
 * promote into a real Contact (pages/api/cartography/contacts/promote.ts).
 *
 * Includes legacy promoted rows: importing does not consume the shared candidate.
 * Only the contributing company may edit its source fields.
 */
export default withAuth(
  async (req, res, session) => {
    const statusParam = asQueryStr(req.query.status);
    const statuses = statusParam ? [statusParam] : REVIEWABLE_STATUSES;

    try {
      const rows = await prisma.cartographyContact.findMany({
        where: { status: { in: statuses } },
        include: { cartography_companies: true },
        orderBy: { created_at: "desc" },
        take: 200,
      });

      const results: CartographyReviewRow[] = rows.map((r) => ({
        id: r.id,
        canEdit: r.company_id === session.companyId && r.status !== "promoted",
        company: r.cartography_companies.name,
        domain: r.cartography_companies.domain,
        industry: r.cartography_companies.industry,
        description: r.cartography_companies.description,
        location: r.cartography_companies.address,
        sourceMethod: r.cartography_companies.source_method,
        name: r.name,
        title: r.title,
        email: r.email,
        phone: r.phone,
        linkedinUrl: r.linkedin_url,
        status: r.status,
        runId: r.run_id,
      }));

      res.status(200).json({ results });
    } catch (error) {
      console.error("[cartography] review queue list failed:", error);
      res.status(502).json({ message: "Couldn't reach the Cartography store." });
    }
  },
  { methods: ["GET"] }
);
