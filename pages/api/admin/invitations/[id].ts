import { withAuth } from "@/lib/api/withAuth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deleteSupabaseAuthUser } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export default withAuth(
  async (req, res, session) => {
    const id = req.query.id;
    const invitationId = Array.isArray(id) ? id[0] : id;
    if (!invitationId) return res.status(400).json({ message: "id is required" });

    const admin = getSupabaseAdmin();
    // Read before deleting: the address is needed to clean up the account the invite created.
    const { data: invitation } = await admin
      .from("invitations")
      .select("id, email, accepted_at")
      .eq("id", invitationId)
      .eq("company_id", session.companyId)
      .maybeSingle();

    const { error } = await admin
      .from("invitations")
      .delete()
      .eq("id", invitationId)
      .eq("company_id", session.companyId);
    if (error) return res.status(500).json({ message: "Failed to revoke invitation" });

    /**
     * Take the account down with the invite.
     *
     * generateLink("invite") creates the Supabase identity up front, so rescinding used to leave
     * a confirmed-nothing account behind: no membership, no client row, invisible in every list —
     * and enough to make re-inviting that address fail as a duplicate forever.
     *
     * Guarded three ways rather than trusting the invite alone. The invite must be unaccepted, and
     * the account must belong nowhere — no membership and no client row — so an address that also
     * happens to be a colleague or a representative is never touched.
     */
    const inv = invitation as { email: string; accepted_at: string | null } | null;
    if (inv && !inv.accepted_at) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: inv.email.trim().toLowerCase() },
          select: {
            id: true,
            company_memberships_company_memberships_user_idTousers: { select: { user_id: true } },
            clients_clients_user_idTousers: { select: { id: true } },
          },
        });
        const belongsSomewhere =
          Boolean(user?.company_memberships_company_memberships_user_idTousers) ||
          Boolean(user?.clients_clients_user_idTousers);
        if (user && !belongsSomewhere) {
          // public.users cascades from auth.users, so removing the identity clears both.
          await deleteSupabaseAuthUser(user.id);
        }
      } catch (cleanupError) {
        // The invite is already gone, which is what was asked for; a stranded identity is a
        // nuisance rather than a failure, and the duplicate check ignores those anyway.
        console.error("admin/invitations DELETE cleanup", cleanupError);
      }
    }

    return res.status(200).json({ success: true });
  },
  { methods: ["DELETE"], roles: ["admin"] }
);
