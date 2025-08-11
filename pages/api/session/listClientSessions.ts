import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const sessions = await prisma.onboardingSession.findMany({
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });

    type SessionWithClient = (typeof sessions)[number];

    const sessionList = sessions.map((session: SessionWithClient) => ({
      token: session.id,
      clientName: session.client.name,
      clientEmail: session.client.email,
      businessName: session.client.businessName,
      createdAt: session.createdAt.getTime(),
      submittedAt: session.submittedAt?.getTime() || null,
      status: session.status || "pending",
      hasAnswers: !!session.answers,
    }));

    res.status(200).json(sessionList);
  } catch (err) {
    console.error("Error listing sessions:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}