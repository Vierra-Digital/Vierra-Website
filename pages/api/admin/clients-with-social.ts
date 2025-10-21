import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Only allow admin and staff roles
  const userRole = (session.user as any).role;
  if (userRole !== "admin" && userRole !== "staff") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    // Fetch clients with their onboarding sessions and platform tokens
    const clients = await prisma.client.findMany({
      where: {
        isActive: true,
      },
      include: {
        onboardingSessions: {
          where: {
            status: "completed",
          },
          include: {
            tokens: {
              select: {
                platform: true,
                accessToken: true,
              },
            },
          },
        },
      },
    });

    // Filter clients that have at least one social media connection
    const clientsWithSocial = clients.filter(client => 
      client.onboardingSessions.some(session => 
        session.tokens.length > 0
      )
    );

    return res.status(200).json(clientsWithSocial);
  } catch (error) {
    console.error("Error fetching clients with social connections:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
