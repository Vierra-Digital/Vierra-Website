import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

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
}
