import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          clients_clients_user_idTousers: {
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
