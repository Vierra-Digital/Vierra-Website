import crypto from "crypto";
import { withSession } from "@/lib/api/withSession";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveBaseUrl } from "@/lib/api/url";

/**
 * Client self-service team management (see docs/ROLE_MODEL_REDESIGN.md's "v2" section, resolved
 * open question #3 discussion) — lets an existing representative invite a colleague to the same
 * client company, so e.g. Exactus can have two people seeing the same campaigns/events.
 * `withSession` (not `withAuth`, which hard-requires kind: "member") because representatives
 * have no other authenticated surface to reach this from — see lib/api/withSession.ts's own
 * doc comment for exactly this use case.
 */
export default withSession(
  async (req, res, session) => {
    if (session.kind !== "client") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const admin = getSupabaseAdmin();

    if (req.method === "GET") {
      const [{ data: representatives, error: repError }, { data: invitations, error: inviteError }] =
        await Promise.all([
          admin
            .from("clients")
            .select("id, name, email, created_at")
            .eq("company_id", session.companyId)
            .order("created_at", { ascending: true }),
          admin
            .from("invitations")
            .select("id, email, expires_at, accepted_at, created_at")
            .eq("company_id", session.companyId)
            .is("accepted_at", null)
            .order("created_at", { ascending: false }),
        ]);
      if (repError || inviteError) return res.status(500).json({ message: "Failed to load team" });
      return res.status(200).json({ representatives, invitations });
    }

    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { error: inviteAuthError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${resolveBaseUrl(req)}/onboarding/accept-invite`,
    });
    if (inviteAuthError) {
      return res.status(400).json({ message: inviteAuthError.message || "Failed to send invite" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    // Always targets the caller's own company_id — a representative can only ever invite a
    // colleague into their own client company, never Vierra's or another client's. role model
    // v2's resolveUser.ts invite-acceptance branch turns this into a representative (clients
    // row) on acceptance, since this company_id is never Vierra's fixed id — `role` is left at
    // its column default, since it's never read on this branch (unlike a Vierra-staff invite).
    const { data, error } = await admin
      .from("invitations")
      .insert({
        company_id: session.companyId,
        email: normalizedEmail,
        token,
        invited_by: session.user.id,
        expires_at: expiresAt,
      })
      .select("id, email, expires_at, accepted_at, created_at")
      .single();
    if (error) return res.status(500).json({ message: "Failed to record invitation" });

    return res.status(201).json(data);
  },
  { methods: ["GET", "POST"] }
);
