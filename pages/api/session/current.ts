import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }

  const { ob_session } = cookie.parse(req.headers.cookie || "");
  console.log("ob_session cookie:", ob_session);
  if (!ob_session) { res.status(401).json({ message: "No onboarding session" }); return; }

  const sess = await prisma.onboardingSession.findUnique({
    where: { id: ob_session },
    include: { client: true },
  });
  if (!sess) { res.status(404).end(); return; }

  res.status(200).json(sess);
}
