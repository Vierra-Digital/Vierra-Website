import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { parseCookie } from "@/lib/api/cookies";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { token, answers, completed = false, clientAnswers = false } = req.body ?? {};
  if (!token) {
    return res.status(400).json({ message: "Missing token" });
  }

  // Same ob_session cookie check every other onboarding route enforces (generateNdaLink.ts,
  // disconnectPlatform.ts, stripe/create-checkout.ts): the token appears in the onboarding URL
  // itself, so it can leak through browser history or a referrer header. The cookie set when the
  // session was first opened is what actually proves this request came from that browser, not just
  // from someone who saw the link — without it, anyone who obtained the token could overwrite this
  // client's saved answers or flip completed: true to close out their onboarding early.
  const cookies = parseCookie(req.headers.cookie || "");
  if (cookies.ob_session !== token) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: token },
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Enforce the same expiry / single-submission gate the read path (session/[token].ts) applies,
    // so an expired or already-submitted onboarding link can't be replayed to overwrite answers.
    const now = new Date();
    if (session.expires_at && now > session.expires_at) {
      return res.status(410).json({ message: "This onboarding link has expired." });
    }
    if (session.status === "completed" || session.submitted_at) {
      return res.status(410).json({ message: "This onboarding form was already submitted." });
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
        last_updated_at: new Date(),
        ...(completed && {
          submitted_at: new Date(),
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
