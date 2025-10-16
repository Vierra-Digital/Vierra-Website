import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!token) return res.status(400).json({ message: "Missing token" });

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: token },
      include: { client: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    return res.status(200).json({
      token: session.id,
      status: session.status,
      createdAt: session.createdAt,
      submittedAt: session.submittedAt,
      lastUpdatedAt: session.lastUpdatedAt,
      client: {
        name: session.client.name,
        email: session.client.email,
        businessName: session.client.businessName,
      },
      answers: session.answers ?? null,
    });
  } catch (e) {
    console.error("sessionAnswers error", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


