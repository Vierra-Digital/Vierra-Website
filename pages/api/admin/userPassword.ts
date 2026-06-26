import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/emailSender";
import { resolveBaseUrl } from "@/lib/api/url";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  const id = req.query.id || (req.body && req.body.id);
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) return res.status(400).json({ message: "id is required" });

  try {
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
  } catch (e) {
    console.error("admin/userPassword", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
