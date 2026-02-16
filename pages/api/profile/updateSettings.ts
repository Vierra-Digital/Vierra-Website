import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const { emailNotifications, twoFactorEnabled, theme, language } = req.body;
    if (theme && !["light", "dark", "auto"].includes(theme)) {
      return res.status(400).json({ message: "Invalid theme value" });
    }
    if (language && !["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"].includes(language)) {
      return res.status(400).json({ message: "Invalid language value" });
    }

    const updateData: any = {};
    if (typeof emailNotifications === "boolean") updateData.emailNotifications = emailNotifications;
    if (typeof twoFactorEnabled === "boolean") updateData.twoFactorEnabled = twoFactorEnabled;
    if (theme) updateData.theme = theme;
    if (language) updateData.language = language;

    const updated = await prisma.user.update({
      where: { email: userEmail },
      data: updateData,
      select: { 
        emailNotifications: true,
        twoFactorEnabled: true,
        theme: true,
        language: true
      },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error("profile/updateSettings", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
