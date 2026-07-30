import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import crypto from "crypto";

export default withAuth(
  async (req, res, session) => {
    const { companyId } = session;

    const { clientEmail } = req.query;
    if (!clientEmail || typeof clientEmail !== "string") {
      return res.status(400).json({ message: "Missing clientEmail" });
    }

    try {
      const client = await prisma.client.findFirst({
        where: { company_id: companyId, email: clientEmail.toLowerCase() },
        include: {
          onboarding_sessions: {
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
      });

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      const latestSession = client.onboarding_sessions[0];
      if (latestSession && latestSession.status !== "completed" && !latestSession.submitted_at) {
        const now = new Date();
        const isExpired = latestSession.expires_at && now > latestSession.expires_at;

        if (!isExpired) {
          return res.status(200).json({
            link: `/onboarding/${latestSession.id}`,
            token: latestSession.id,
            status: latestSession.status,
          });
        }
      }
      const token = crypto.randomUUID();
      await prisma.onboardingSession.create({
        data: {
          id: token,
          client_id: client.id,
          company_id: companyId,
          status: "pending",
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      return res.status(200).json({
        link: `/onboarding/${token}`,
        token: token,
        status: "pending",
        regenerated: true,
      });
    } catch (err: any) {
      console.error("getClientSessionLink error:", err);
      return res.status(500).json({ message: err?.message || "Internal Server Error" });
    }
  },
  { methods: ["GET"], roles: ["admin", "staff"] }
);
