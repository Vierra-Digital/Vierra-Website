import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendClientOnboardingCompletedEmail } from "@/lib/emailSender";
import { resolveBaseUrl } from "@/lib/api/url";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { token, answers, completed } = req.body ?? {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Missing or invalid token" });
  }
  if (answers == null) {
    return res.status(400).json({ message: "Missing answers" });
  }

  try {
    let userEmail: string | null = null;
    let clientName: string | null = null;
    let businessName: string | null = null;
    let userId: string | null = null;

    const precheck = await prisma.onboardingSession.findUnique({
      where: { id: token },
      include: { clients: true },
    });
    if (!precheck) throw new Error("Session not found");
    if (!precheck.clients) throw new Error("Client missing for session");

    let newSupabaseUserId: string | null = null;
    if (completed) {
      const existingUser = await prisma.user.findUnique({
        where: { email: precheck.clients.email.toLowerCase() },
      });
      if (!existingUser) {
        const authUser = await createSupabaseAuthUser(precheck.clients.email.toLowerCase());
        newSupabaseUserId = authUser.id;
      }
    }

    await prisma.$transaction(async (tx) => {
      const sess = await tx.onboardingSession.findUnique({
        where: { id: token },
        include: { clients: true },
      });
      if (!sess) throw new Error("Session not found");
      if (!sess.clients) throw new Error("Client missing for session");
      const updateData: Record<string, unknown> = {
        answers,
        last_updated_at: new Date(),
      };
      if (sess.status === "pending") updateData.status = "in_progress";
      if (completed) {
        updateData.submitted_at = new Date();
        updateData.status = "completed";
      }
      await tx.onboardingSession.update({ where: { id: token }, data: updateData });
      if (!completed) return;
      const email = sess.clients.email.toLowerCase();
      userEmail = email;
      clientName = sess.clients.name;
      businessName = sess.clients.business_name;

      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: { id: newSupabaseUserId!, email, name: sess.clients.name },
        });
      } else if (!user.name && sess.clients.name) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { name: sess.clients.name },
        });
      }
      userId = user.id;
      if (!sess.clients.user_id || sess.clients.user_id !== user.id) {
        await tx.client.update({ where: { id: sess.clients.id }, data: { user_id: user.id } });
      }
      const tmpTokens = await tx.onboardingPlatformToken.findMany({
        where: { session_id: token },
        select: { platform: true, access_token: true, refresh_token: true, expires_at: true },
      });

      for (const t of tmpTokens) {
        await tx.platformToken.upsert({
          where: { user_id_platform: { user_id: user.id, platform: t.platform } },
          update: { access_token: t.access_token, refresh_token: t.refresh_token },
          create: {
            user_id: user.id,
            platform: t.platform,
            access_token: t.access_token,
            refresh_token: t.refresh_token,
          },
        });
      }
      if (tmpTokens.length > 0) {
        await tx.onboardingPlatformToken.deleteMany({ where: { session_id: token } });
      }
      await tx.onboardingSession.update({
        where: { id: token },
        data: { consumed_at: new Date() },
      });
    });

    if (completed && userId && userEmail) {
      try {
        const baseUrl = resolveBaseUrl(req);
        const supabase = getSupabaseAdmin();
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: userEmail,
          options: { redirectTo: `${baseUrl}/set-password` },
        });
        const setPasswordLink = (linkData as any)?.properties?.action_link ?? `${baseUrl}/set-password`;
        await sendClientOnboardingCompletedEmail(
          userEmail,
          clientName || "there",
          businessName || "",
          setPasswordLink
        );
      } catch (emailErr) {
        console.error("submitClientAnswers: failed to send onboarding completion email:", emailErr);
      }
    }

    return res.status(200).json({
      ok: true,
      message: newSupabaseUserId
        ? "User created, linked, and tokens migrated."
        : "User linked and tokens migrated.",
    });
  } catch (err) {
    console.error("Error saving answers / completing:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
