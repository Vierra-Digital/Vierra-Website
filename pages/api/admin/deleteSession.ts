import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Session token is required" });
    }

    try {
      // Scope to the admin's own company — a session id from another company must 404, not delete
      // that company's session + client.
      const onboardingSession = await prisma.onboardingSession.findFirst({
        where: { id: token, company_id: session.companyId },
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
