import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/emailSender";
import { resolveBaseUrl } from "@/lib/api/url";

export default withAuth(
  async (req, res) => {
    const id = req.query.id || (req.body && req.body.id);
    const userId = Array.isArray(id) ? id[0] : id;
    if (!userId) return res.status(400).json({ message: "id is required" });

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, email: true, name: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.email) return res.status(400).json({ message: "User has no email on file." });

    const baseUrl = resolveBaseUrl(req);
    const admin = getSupabaseAdmin();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: user.email,
      options: { redirectTo: `${baseUrl}/set-password` },
    });
    const resetLink = (linkData as any)?.properties?.action_link ?? `${baseUrl}/set-password`;
    await sendPasswordResetEmail(user.email, user.name || "", resetLink);

    return res.status(200).json({ message: "Password reset email sent." });
  },
  { methods: ["POST"], roles: ["admin"] }
);
