import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { token, answers, completed = false, clientAnswers = false } = req.body ?? {};
  if (!token) {
    return res.status(400).json({ message: "Missing token" });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: token },
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const existingAnswers = (session.answers as any) || {};
    const updatedAnswers = { ...existingAnswers, ...answers };
    let newStatus: string | undefined;
    if (completed) {
      newStatus = "completed";
    } else if (clientAnswers && session.status === "pending") {
      newStatus = "in_progress";
    }

    await prisma.onboardingSession.update({
      where: { id: token },
      data: {
        answers: updatedAnswers,
        lastUpdatedAt: new Date(),
        ...(completed && {
          submittedAt: new Date(),
        }),
        ...(newStatus && {
          status: newStatus
        })
      },
    });

    return res.status(200).json({ message: "Answers saved successfully" });
  } catch (err: any) {
    console.error("Failed to save answers:", err);
    return res.status(500).json({ message: "Failed to save answers" });
  }
}
