import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    const { emailNotifications, theme, language } = req.body;
    if (theme && !["light", "dark", "auto"].includes(theme)) {
      return res.status(400).json({ message: "Invalid theme value" });
    }
    if (language && !["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"].includes(language)) {
      return res.status(400).json({ message: "Invalid language value" });
    }

    const prefData: Record<string, unknown> = {};
    if (typeof emailNotifications === "boolean") prefData.email_notifications = emailNotifications;
    if (theme) prefData.theme = theme;
    if (language) prefData.language = language;

    const updated = await prisma.userPreference.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...prefData },
      update: prefData,
      select: { email_notifications: true, theme: true, language: true },
    });

    return res.status(200).json({
      emailNotifications: updated.email_notifications,
      theme: updated.theme,
      language: updated.language,
    });
  },
  { methods: ["POST"] }
);
