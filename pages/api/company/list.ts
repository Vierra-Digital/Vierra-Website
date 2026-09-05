import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { getVierraCompanyId } from "@/lib/auth/vierraCompany";

/**
 * Lists every client business, for the panel's client switcher (see
 * docs/ROLE_MODEL_REDESIGN.md's "v2" section, Phase 4) — every Vierra staff member may work on
 * any client's data, so this has no per-caller filtering beyond excluding Vierra's own fixed
 * company row, which isn't a client to switch to.
 */
export default withAuth(
  async (_req, res) => {
    const vierraCompanyId = await getVierraCompanyId();
    const companies = await prisma.company.findMany({
      where: { id: { not: vierraCompanyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ companies });
  },
  { methods: ["GET"] }
);
