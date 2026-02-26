import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { encrypt } from "@/lib/crypto";
import { sendClientOnboardingCompletedEmail } from "@/lib/emailSender";

function generatePassword(len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%^*_-";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

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
    let initialPassword: string | null = null;
    let userEmail: string | null = null;
    let clientName: string | null = null;
    let businessName: string | null = null;
    let userId: number | null = null;

    await prisma.$transaction(async (tx) => {
      const sess = await tx.onboardingSession.findUnique({
        where: { id: token },
        include: { client: true },
      });
      if (!sess) throw new Error("Session not found");
      if (!sess.client) throw new Error("Client missing for session");
      const updateData: any = {
        answers,
        lastUpdatedAt: new Date(),
      };
      if (sess.status === "pending") updateData.status = "in_progress";
      if (completed) {
        updateData.submittedAt = new Date();
        updateData.status = "completed";
      }
      await tx.onboardingSession.update({ where: { id: token }, data: updateData });
      if (!completed) return;
      const email = sess.client.email.toLowerCase();
      userEmail = email;
      clientName = sess.client.name;
      businessName = sess.client.businessName;

      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        initialPassword = generatePassword(14);
        const passwordEnc = encrypt(initialPassword);
        user = await tx.user.create({
          data: { email, passwordEnc, role: "user", name: sess.client.name },
        });
      } else if (!user.name && sess.client.name) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { name: sess.client.name },
        });
      }
      userId = user.id;
      if (!sess.client.userId || sess.client.userId !== user.id) {
        await tx.client.update({ where: { id: sess.client.id }, data: { userId: user.id } });
      }
      const tmpTokens = await tx.onboardingPlatformToken.findMany({
        where: { sessionId: token },
        select: { platform: true, accessToken: true, refreshToken: true, expiresAt: true },
      });

      for (const t of tmpTokens) {
        await tx.userToken.upsert({
          where: { userId_platform: { userId: user.id, platform: t.platform as any } },
          update: { accessToken: t.accessToken, refreshToken: t.refreshToken },
          create: {
            userId: user.id,
            platform: t.platform as any,
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
  
          },
        });
      }
      if (tmpTokens.length > 0) {
        await tx.onboardingPlatformToken.deleteMany({ where: { sessionId: token } });
      }
      await tx.onboardingSession.update({
        where: { id: token },
        data: { consumedAt: new Date() },
      });
    });

    if (completed && userId && userEmail) {
      try {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.passwordResetToken.create({
          data: {
            token: resetToken,
            userId,
            expiresAt,
          },
        });
        const baseUrl = (process.env.NEXTAUTH_URL || `https://${req.headers.host || "vierradev.com"}`).replace(/\/+$/, "");
        const setPasswordLink = `${baseUrl}/set-password/${resetToken}`;
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
      message: initialPassword
        ? "User created, linked, and tokens migrated."
        : "User linked and tokens migrated.",
      credentials: initialPassword ? { email: userEmail, password: initialPassword } : null,
    });
  } catch (err) {
    console.error("Error saving answers / completing:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
