import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

/**
 * Updates the caller's display name. Uses requireSession (any kind), not requireRole
 * (kind: "member" only) — role model v2's onboarding wizard runs its "name" step for a brand-new
 * client representative (kind: "client") too, not just Vierra staff, since onboarding now creates
 * a clients row for the onboarding user instead of a company_memberships row (see
 * docs/ROLE_MODEL_REDESIGN.md, pages/api/onboarding/create-company.ts).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  if (session.kind === "unaffiliated") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { name } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "name is required" });
  }
  const trimmed = name.trim();

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: trimmed },
    });
    if (session.kind === "client") {
      await prisma.client.update({
        where: { id: session.clientId },
        data: { name: trimmed },
      });
    }
    return res.status(200).json({ message: "Updated" });
  } catch (e) {
    console.error("profile/update", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
