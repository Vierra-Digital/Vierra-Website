import crypto from "crypto";
import { withAuth } from "@/lib/api/withAuth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveBaseUrl } from "@/lib/api/url";
import { sendInviteEmail } from "@/lib/emailSender";

// Inviting teammates is admin-only, not staff.
export default withAuth(
  async (req, res, session) => {
    const admin = getSupabaseAdmin();

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("invitations")
        .select("id, email, role, expires_at, accepted_at, created_at, first_name, last_name, position, mentor_id, time_zone, strikes")
        .eq("company_id", session.companyId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ message: "Failed to load invitations" });
      return res.status(200).json(data);
    }

    // `role` is deliberately not read: master's role model v2 makes every invite "staff" on
    // acceptance, so a role sent by the client would be ignored anyway. The rest is the staff
    // detail this branch added, carried on the invitation until it is accepted.
    const { email, firstName, lastName, position, mentorId, timeZone, strikes } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    // Optional staff detail. Carried on the invitation and applied to the membership when it is
    // accepted, since there is no user row to hang it on until then.
    const strikeCount = Number.isFinite(Number(strikes)) ? Math.min(3, Math.max(0, Math.trunc(Number(strikes)))) : 0;
    const asText = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

    // Mint-only (never sends) — Supabase's own invite email goes out through its dashboard SMTP
    // config, which fails DMARC for this domain (see the chat this shipped from). We send our own
    // branded email through the Gmail-API system sender instead, same pattern as password resets.
    const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: { redirectTo: `${resolveBaseUrl(req)}/onboarding/accept-invite` },
    });
    if (inviteError) {
      return res.status(400).json({ message: inviteError.message || "Failed to create invite" });
    }
    const inviteLink = (linkData as any)?.properties?.action_link;
    if (!inviteLink) {
      return res.status(500).json({ message: "Failed to generate invite link" });
    }
    try {
      await sendInviteEmail(normalizedEmail, inviteLink);
    } catch {
      return res.status(502).json({ message: "Invite created, but the email could not be sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    // role model v2: every invite created here targets Vierra's own fixed company (session.companyId,
    // for a member session, always resolves there post-migration) and always becomes "staff" on
    // acceptance (lib/auth/resolveUser.ts) — there is no admin-via-invite path.
    const { data, error } = await admin
      .from("invitations")
      .insert({
        company_id: session.companyId,
        email: normalizedEmail,
        role: "staff",
        token,
        invited_by: session.user.id,
        expires_at: expiresAt,
        first_name: asText(firstName),
        last_name: asText(lastName),
        position: asText(position),
        mentor_id: asText(mentorId),
        time_zone: asText(timeZone),
        strikes: strikeCount,
      })
      .select("id, email, role, expires_at, accepted_at, created_at, first_name, last_name, position, mentor_id, time_zone, strikes")
      .single();
    if (error) return res.status(500).json({ message: "Failed to record invitation" });

    return res.status(201).json(data);
  },
  { methods: ["GET", "POST"], roles: ["admin"] }
);
