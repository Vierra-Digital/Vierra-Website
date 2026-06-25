import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  if (req.method !== "DELETE") return res.status(405).json({ message: "Method Not Allowed" });

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
}
