import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { clientName, clientEmail, businessName, industry } = req.body ?? {};
  if (!clientName || !clientEmail || !businessName) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const email = String(clientEmail).toLowerCase();

    const token = crypto.randomUUID();
    const client = await prisma.client.upsert({
      where: { email },
      create: { name: clientName, email, businessName },
      update: { name: clientName, businessName },
      select: { id: true, name: true, email: true, businessName: true, createdAt: true },
    });
    const session = await prisma.onboardingSession.create({
      data: {
        id: token,
        clientId: client.id,
        status: "pending",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        answers: { industry },
      },
      select: { id: true, createdAt: true, submittedAt: true, status: true, answers: true },
    });

    return res.status(200).json({
      link: `/session/${token}`, token,
      summary: {
        token: session.id,
        clientName: client.name,
        clientEmail: client.email,
        businessName: client.businessName,
        createdAt: new Date(session.createdAt).getTime(),
        submittedAt: session.submittedAt ? new Date(session.submittedAt).getTime() : null,
        status: session.status ?? "pending",
        hasAnswers: !!session.answers,
      },
    });
  } catch (err) {
    console.error("Create session failed:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
