import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Admin-only management of shared-inbox delegation grants (mailbox_grants). An admin grants a
 * teammate read + optional send access to a mailbox. Company-scoped.
 *
 *   GET    → { grants: [...] }         list this company's grants
 *   POST   { granteeUserId, accountEmail, canSend? } → create/update a grant
 *   DELETE { id }                      revoke a grant
 *
 * NOTE: this manages the grant records. Per-endpoint *enforcement* (messages/detail/send
 * honoring grants) is wired via lib/email/mailboxAccess.ts — see the rollout.
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = session.companyId;

    if (req.method === "GET") {
      const grants = await prisma.mailboxGrant.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
        select: { id: true, grantee_user_id: true, account_email: true, can_send: true, granted_by: true, created_at: true },
      });
      res.status(200).json({
        grants: grants.map((g) => ({
          id: g.id,
          granteeUserId: g.grantee_user_id,
          accountEmail: g.account_email,
          canSend: g.can_send,
          grantedBy: g.granted_by,
          createdAt: g.created_at.toISOString(),
        })),
      });
      return;
    }

    if (req.method === "POST") {
      const granteeUserId = asStr(req.body?.granteeUserId);
      const accountEmail = asStr(req.body?.accountEmail).toLowerCase();
      const canSend = req.body?.canSend !== false;
      if (!granteeUserId || !accountEmail) {
        res.status(400).json({ message: "granteeUserId and accountEmail are required." });
        return;
      }
      const grant = await prisma.mailboxGrant.upsert({
        where: { grantee_user_id_account_email: { grantee_user_id: granteeUserId, account_email: accountEmail } },
        update: { can_send: canSend, company_id: companyId, granted_by: session.user.id },
        create: {
          company_id: companyId,
          grantee_user_id: granteeUserId,
          account_email: accountEmail,
          can_send: canSend,
          granted_by: session.user.id,
        },
        select: { id: true },
      });
      res.status(200).json({ ok: true, id: grant.id });
      return;
    }

    if (req.method === "DELETE") {
      const id = asStr(req.body?.id);
      if (!id) {
        res.status(400).json({ message: "id is required." });
        return;
      }
      // Scope the delete to this company so an admin can't revoke another company's grant.
      await prisma.mailboxGrant.deleteMany({ where: { id, company_id: companyId } });
      res.status(200).json({ ok: true });
      return;
    }
  },
  { methods: ["GET", "POST", "DELETE"], roles: ["admin"] }
);
