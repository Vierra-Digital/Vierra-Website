import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX } from "@/lib/utils";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

export type PromoteResult = { id: string; ok: boolean; contactId?: string; reason?: string };

/**
 * Bulk-promotes review-queue rows into real Contact records (see
 * docs/CARTOGRAPHY_DESIGN.md Rollout M4 and the Storage section's note on this being the one
 * place Cartography acts on the main app's data rather than just tagging it with an ID — once
 * Cartography is a genuinely separate service, this becomes a real API call between two
 * services instead of a same-database write).
 *
 * Processed one id at a time, not in parallel — each row's outcome (promoted / skipped /
 * failed, and why) needs to be individually attributable back to the caller, not collapsed
 * into one batch success/failure.
 */
export default withAuth(
  async (req, res, session) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown): id is string => typeof id === "string") : [];
    if (ids.length === 0) {
      res.status(400).json({ message: "ids must be a non-empty array." });
      return;
    }
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }

    const results: PromoteResult[] = [];

    for (const id of ids) {
      try {
        const candidate = await prisma.cartographyContact.findUnique({
          where: { id },
          include: { cartography_companies: true },
        });

        if (!candidate) {
          results.push({ id, ok: false, reason: "Not found." });
          continue;
        }
        if (candidate.status === "rejected" || candidate.status === "duplicate") {
          results.push({ id, ok: false, reason: `Marked ${candidate.status} — un-reject it first.` });
          continue;
        }
        const email = candidate.email?.trim().toLowerCase() || "";
        if (!email || !EMAIL_REGEX.test(email)) {
          results.push({ id, ok: false, reason: "No valid email on this candidate — add one before promoting." });
          continue;
        }

        // Dedupe against an existing Contact for this client company (contacts are client-scoped
        // — see docs/ROLE_MODEL_REDESIGN.md's "v2" section) rather than relying on the
        // account_id-scoped unique index, which never fires here since account_id stays
        // null for a cartography-sourced contact.
        const existingContact = await prisma.contact.findFirst({
          where: { company_id: companyId, email },
        });

        const [firstName, ...rest] = (candidate.name || "").trim().split(/\s+/).filter(Boolean);
        const lastName = rest.join(" ");

        const contact =
          existingContact ||
          (await prisma.contact.create({
            data: {
              company_id: companyId,
              user_id: session.user.id,
              source: "cartography",
              email,
              first_name: firstName || null,
              last_name: lastName || null,
              business: candidate.cartography_companies.name || null,
              website: candidate.cartography_companies.domain || null,
              address: candidate.cartography_companies.address || null,
              phone: candidate.phone || null,
            },
          }));

        // The shared candidate remains available to other users. Import ownership and
        // deduplication belong to the destination Contacts list, not the source row.

        results.push({ id, ok: true, contactId: contact.id });
      } catch (error) {
        console.error(`[cartography] promotion failed for ${id}:`, error);
        results.push({ id, ok: false, reason: "Couldn't reach the Cartography store." });
      }
    }

    res.status(200).json({ results });
  },
  { methods: ["POST"] }
);
