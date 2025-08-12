import { prisma } from "@/lib/prisma";
import cookie from "cookie";

export async function requireOnboardingSession(req: any, res: any, token: string) {
  // Load session and basic checks you already do:
  const sess = await prisma.onboardingSession.findUnique({ where: { id: token } });
  if (!sess) return null;

  // Check not expired nr not completed
  if (sess.status === "expired" || sess.submittedAt) return null;

  // Check the single-use cookie exists
  const cookies = cookie.parse(req.headers.cookie || "");
  if (!cookies[`onb_${token}`]) return null;

  return sess;
}
