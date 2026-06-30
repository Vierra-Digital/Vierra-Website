import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res) => {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Session token is required" });
    }

    try {
      const onboardingSession = await prisma.onboardingSession.findUnique({
        where: { id: token },
      });

      if (!onboardingSession) {
        return res.status(404).json({ message: "Session not found" });
      }
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const updated = await prisma.onboardingSession.update({
        where: { id: token },
        data: {
          status: "pending",
          expires_at: newExpiresAt,
          last_updated_at: now,
        },
      });

      res.status(200).json({
        message: "Session renewed successfully",
        token: updated.id,
        status: updated.status,
        link: `/onboarding/${updated.id}`,
      });
    } catch (err) {
      console.error("/api/admin/renewSession error", err);
      res.status(500).json({ message: "Failed to renew session" });
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
