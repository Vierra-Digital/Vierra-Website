import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import cookie from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ message: "Missing or invalid token" });
  }

  try {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: token },
      include: { client: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const now = new Date();
    // Hard expiry (1 hour after creation via expiresAt)
    if (session.expiresAt && now > session.expiresAt) {
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

    // If already submitted, block
    if (session.status === "completed" || session.submittedAt) {
      return res.status(410).json({ message: "Session already submitted" });
    }

    // Single-use link via cookie
    const cookieName = `onb_${token}`;
    const cookies = cookie.parse(req.headers.cookie || "");
    const hasCookie = Boolean(cookies[cookieName]);

    if (!session.firstAccessedAt) {
      // First click - allow and set firstAccessedAt + cookie
      const updated = await prisma.onboardingSession.update({
        where: { id: token },
        data: { firstAccessedAt: now, status: "in_progress" },
        include: { client: true },
      });

      // Set HttpOnly cookie valid for the remaining time (max 1h)
      const secondsLeft = session.expiresAt
        ? Math.max(1, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000))
        : 60 * 60;

      const cookiesToSet = [
        // one-time link guard (cookie only needs to come back to this API group)
        cookie.serialize(`onb_${token}`, "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/api/session",
          maxAge: secondsLeft,
        }),
        // resume cookie for token-less /session route after OAuth
        cookie.serialize("ob_session", token, {
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

    // Already accessed before:
    // Only allow if the same browser presents the cookie; otherwise "already used"
    if (!hasCookie) {
      return res.status(410).json({ message: "Link already used" });
    }

    return res.status(200).json(session);
  } catch (err) {
    console.error("Error reading session:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
