import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { createSupabaseAuthUser, getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendStaffSetPasswordEmail } from "@/lib/emailSender";
import { resolveBaseUrl } from "@/lib/api/url";

export default withAuth(
  async (req, res, session) => {
    const { companyId } = session;

    const { name, email, position, time_zone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const staffEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: staffEmail } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const authUser = await createSupabaseAuthUser(staffEmail);

    let newUser;
    try {
      newUser = await prisma.user.create({
        data: { id: authUser.id, name: name.trim(), email: staffEmail },
        select: { id: true, name: true, email: true },
      });
      await prisma.companyMembership.create({
        data: {
          company_id: companyId,
          user_id: authUser.id,
          role: "staff",
          position: position?.trim() || null,
          status: "offline",
        },
      });
      if (time_zone) {
        await prisma.userPreference.upsert({
          where: { user_id: authUser.id },
          create: { user_id: authUser.id, time_zone: time_zone.trim() },
          update: { time_zone: time_zone.trim() },
        });
      }
    } catch (createErr) {
      await getSupabaseAdmin().auth.admin.deleteUser(authUser.id).catch(() => {});
      throw createErr;
    }

    const baseUrl = resolveBaseUrl(req);
    const admin = getSupabaseAdmin();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: staffEmail,
      options: { redirectTo: `${baseUrl}/set-password` },
    });
    const setPasswordLink = (linkData as any)?.properties?.action_link ?? `${baseUrl}/set-password`;

    try {
      await sendStaffSetPasswordEmail(staffEmail, name.trim(), setPasswordLink);
    } catch (emailErr) {
      console.error("addStaff: Failed to send set-password email:", emailErr);
      await prisma.user.delete({ where: { id: newUser.id } }).catch(() => {});
      await getSupabaseAdmin().auth.admin.deleteUser(authUser.id).catch(() => {});
      return res.status(500).json({ message: "Failed to send welcome email. Please try again." });
    }

    return res.status(201).json({
      message: "Staff member created successfully",
      user: { ...newUser, role: "staff" },
    });
  },
  { methods: ["POST"] }
);
