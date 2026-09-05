import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { asStr, asQueryStr } from "@/lib/api/parsing";
import { EMAIL_REGEX } from "@/lib/utils";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

const EDITABLE_STATUSES = ["candidate", "reviewed", "rejected", "duplicate"];

/**
 * Edit or resolve one review-queue row (see docs/CARTOGRAPHY_DESIGN.md Rollout M4) — fill in
 * a real name/email/phone/title Artemis never fabricates, or mark it rejected/duplicate.
 * Never promotes here (see promote.ts) and never hard-deletes (matches the no-hard-delete
 * rule everywhere else in this schema) — "reject" is a status, not a DELETE.
 */
export default withAuth(
  async (req, res, session) => {
    const id = asQueryStr(req.query.id);
    const companyId = resolveTargetCompanyId(session, req);
    const existing = await prisma.cartographyContact.findUnique({ where: { id } });
    if (!existing || !companyId || existing.company_id !== companyId) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    if (existing.status === "promoted") {
      res.status(400).json({ message: "This candidate has already been promoted to a contact." });
      return;
    }

    const name = req.body?.name !== undefined ? asStr(req.body.name) || null : undefined;
    const title = req.body?.title !== undefined ? asStr(req.body.title) || null : undefined;
    const phone = req.body?.phone !== undefined ? asStr(req.body.phone) || null : undefined;
    const linkedinUrl = req.body?.linkedinUrl !== undefined ? asStr(req.body.linkedinUrl) || null : undefined;
    const status = req.body?.status !== undefined ? asStr(req.body.status) : undefined;

    let email: string | null | undefined;
    if (req.body?.email !== undefined) {
      const trimmed = asStr(req.body.email);
      if (trimmed && !EMAIL_REGEX.test(trimmed)) {
        res.status(400).json({ message: "Email is invalid." });
        return;
      }
      email = trimmed || null;
    }

    if (status !== undefined && !EDITABLE_STATUSES.includes(status)) {
      res.status(400).json({ message: `Status must be one of: ${EDITABLE_STATUSES.join(", ")}.` });
      return;
    }

    try {
      const updated = await prisma.cartographyContact.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(email !== undefined ? { email, enrichment_status: "enriched" } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(linkedinUrl !== undefined ? { linkedin_url: linkedinUrl } : {}),
          ...(status !== undefined ? { status } : {}),
          updated_at: new Date(),
        },
      });
      res.status(200).json({ id: updated.id, status: updated.status });
    } catch (error) {
      console.error("[cartography] review row update failed:", error);
      res.status(502).json({ message: "Couldn't reach the Cartography store." });
    }
  },
  { methods: ["PATCH"] }
);
