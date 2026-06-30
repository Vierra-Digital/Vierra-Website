import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        user_preferences: { select: { email_notifications: true, theme: true, language: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const prefs = user.user_preferences;
    return res.status(200).json({
      emailNotifications: prefs?.email_notifications ?? true,
      theme: prefs?.theme ?? "auto",
      language: prefs?.language ?? "en",
    });
  },
  { methods: ["GET"] }
);
