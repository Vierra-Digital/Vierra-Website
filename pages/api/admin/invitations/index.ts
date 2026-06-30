import crypto from "crypto";
import { withAuth } from "@/lib/api/withAuth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveBaseUrl } from "@/lib/api/url";

// Inviting teammates is admin-only, not staff.
export default withAuth(
  async (req, res, session) => {
    const admin = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("invitations")
        .select("id, email, role, expires_at, accepted_at, created_at")
        .eq("company_id", session.companyId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ message: "Failed to load invitations" });
      return res.status(200).json(data);
    }

    const { email, role } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required" });
    }
    if (role !== "admin" && role !== "staff") {
      return res.status(400).json({ message: "role must be 'admin' or 'staff'" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${resolveBaseUrl(req)}/login`,
    });
    if (inviteError) {
      return res.status(400).json({ message: inviteError.message || "Failed to send invite" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("invitations")
      .insert({
        company_id: session.companyId,
        email: normalizedEmail,
        role,
        token,
        invited_by: session.user.id,
        expires_at: expiresAt,
      })
      .select("id, email, role, expires_at, accepted_at, created_at")
      .single();
    if (error) return res.status(500).json({ message: "Failed to record invitation" });

    return res.status(201).json(data);
  },
  { methods: ["GET", "POST"], roles: ["admin"] }
);
