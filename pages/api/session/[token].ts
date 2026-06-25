import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ message: "Missing or invalid token" });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: token },
      include: { clients: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const now = new Date();
    if (session.expires_at && now > session.expires_at) {
      if (session.status !== "expired") {
        try {
          await prisma.onboardingSession.update({
            where: { id: token },
            data: { status: "expired" },
          });
        } catch (e: any) {
          console.error("Marking session expired failed", {
            message: e?.message,
            code: e?.code,
            meta: e?.meta,
            stack: e?.stack,
          });
        }
      }
      return res.status(410).json({ message: "Session expired" });
    }
    if (session.status === "completed" || session.submitted_at) {
      return res.status(410).json({ message: "Session already submitted" });
    }
    const cookieName = `onb_${token}`;
    const cookies = parseCookie(req.headers.cookie ?? "");
    const hasCookie = Boolean(cookies[cookieName]);

    if (!session.first_accessed_at) {
      const updated = await prisma.onboardingSession.update({
        where: { id: token },
        data: { first_accessed_at: now, status: "in_progress" },
        include: { clients: true },
      });
      const secondsLeft = session.expires_at
        ? Math.max(1, Math.floor((session.expires_at.getTime() - now.getTime()) / 1000))
        : 60 * 60;

      const cookiesToSet = [
        serializeCookie(`onb_${token}`, "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/api/session",
          maxAge: secondsLeft,
        }),
        serializeCookie("ob_session", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: secondsLeft,
        }),
      ];

      res.setHeader("Set-Cookie", cookiesToSet);
      return res.status(200).json(updated);
    }
    if (!hasCookie) {
      return res.status(410).json({ message: "Link already used" });
    }

    return res.status(200).json(session);
  } catch (err) {
    console.error("Error reading session:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
