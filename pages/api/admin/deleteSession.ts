import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Session token is required" });
    }

    try {
      const onboardingSession = await prisma.onboardingSession.findUnique({
        where: { id: token },
        select: { id: true, client_id: true }
      });

      if (!onboardingSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      const clientId = onboardingSession.client_id;
      await prisma.$transaction(async (tx) => {
        await tx.onboardingSession.delete({
          where: { id: token }
        });
        await tx.client.delete({
          where: { id: clientId }
        });
      });

      res.status(200).json({ message: "Session and client deleted successfully", token });
    } catch (err) {
      console.error("/api/admin/deleteSession error", err);
      res.status(500).json({ message: "Failed to delete session" });
    }
  },
  { methods: ["DELETE"], roles: ["admin"] }
);
