import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

export default withAuth(
  async (req, res, session) => {
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }
    try {
      const users = await prisma.user.findMany({
        where: {
          clients_clients_user_idTousers: {
            // Scope to the target client company — without this the query returned completed
            // users across every client.
            company_id: companyId,
            onboarding_sessions: {
              some: { status: "completed" },
            },
          },
        },
        select: {
          id: true,
          email: true,
          clients_clients_user_idTousers: { select: { name: true } },
        },
      });

      const shaped = users.map((u) => ({
        id: u.id,
        email: u.email,
        client: u.clients_clients_user_idTousers ?? null,
      }));

      res.json(shaped);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch completed users" });
    }
  },
  { methods: ["GET"], roles: ["admin"] }
);
