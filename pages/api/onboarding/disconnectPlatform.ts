import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { parseCookie } from "@/lib/api/cookies"

const ALLOWED_PLATFORMS = new Set(["facebook", "linkedin", "googleads"])

/**
 * Lets a client disconnect a social account mid-onboarding (e.g. they connected the wrong login)
 * so they can reconnect the right one — the wizard otherwise had no way to clear a connected
 * token once made. Same ob_session cookie check as generateNdaLink.ts: the session id in the
 * body must match the cookie set when this onboarding session started, not just any caller who
 * knows the id.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const { onboardingToken, platform } = req.body ?? {}
  if (!onboardingToken || typeof onboardingToken !== "string") {
    return res.status(400).json({ message: "onboardingToken is required." })
  }
  if (typeof platform !== "string" || !ALLOWED_PLATFORMS.has(platform)) {
    return res.status(400).json({ message: "Invalid platform." })
  }

  const cookies = parseCookie(req.headers.cookie || "")
  if (cookies.ob_session !== onboardingToken) {
    return res.status(403).json({ message: "Forbidden" })
  }

  await prisma.onboardingPlatformToken.deleteMany({
    where: { session_id: onboardingToken, platform },
  })

  return res.status(200).json({ disconnected: true })
}
