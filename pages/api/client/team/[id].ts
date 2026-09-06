import { withSession } from "@/lib/api/withSession";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Revokes a pending representative invite (see pages/api/client/team/index.ts). */
export default withSession(
  async (req, res, session) => {
    if (session.kind !== "client") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const id = req.query.id;
    const invitationId = Array.isArray(id) ? id[0] : id;
    if (!invitationId) return res.status(400).json({ message: "id is required" });

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("invitations")
      .delete()
      .eq("id", invitationId)
      .eq("company_id", session.companyId);
    if (error) return res.status(500).json({ message: "Failed to revoke invitation" });

    return res.status(200).json({ success: true });
  },
  { methods: ["DELETE"] }
);
