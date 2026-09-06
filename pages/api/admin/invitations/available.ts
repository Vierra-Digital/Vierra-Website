import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

/**
 * Whether an address can still be invited.
 *
 * The invite dialog asks as you type so it can keep Send Invite disabled, rather than letting the
 * invite be sent and answering with an error. It reports a boolean and nothing else — no name, no
 * confirmation that a particular person is a colleague — so it cannot be used to probe who has an
 * account here.
 *
 * "Taken" matches the POST exactly: an account that belongs nowhere is a leftover from a rescinded
 * invite and does not hold the address.
 */
export default withAuth(
  async (req, res, session) => {
    const raw = req.query.email;
    const email = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email is required" });

    try {
      const [user, invite] = await Promise.all([
        prisma.user.findUnique({
          where: { email },
          select: {
            company_memberships_company_memberships_user_idTousers: { select: { user_id: true } },
            clients_clients_user_idTousers: { select: { id: true } },
          },
        }),
        prisma.invitation.findFirst({
          where: { email, company_id: session.companyId, accepted_at: null },
          select: { id: true },
        }),
      ]);
      const taken =
        Boolean(user?.company_memberships_company_memberships_user_idTousers) ||
        Boolean(user?.clients_clients_user_idTousers) ||
        Boolean(invite);
      return res.status(200).json({ available: !taken });
    } catch (e) {
      console.error("admin/invitations/available", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
  { methods: ["GET"], roles: ["admin"] }
);
