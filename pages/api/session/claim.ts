import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const { token } = (req.body ?? {}) as { token?: string };
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  const sess = await prisma.onboardingSession.findUnique({ where: { id: token } });
  if (!sess) {
    res.status(404).send("Invalid session");
    return;
  }

  if (!sess.firstAccessedAt) {
    await prisma.onboardingSession.update({
      where: { id: token },
      data: { firstAccessedAt: new Date() },
    });
  }

  res.setHeader(
    "Set-Cookie",
    cookie.serialize("ob_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })
  );

  res.status(204).end();
}
