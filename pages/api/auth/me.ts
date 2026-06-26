import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  return res.status(200).json({
    ...session.user,
    kind: session.kind,
    companyId: (session as any).companyId,
    clientId: (session as any).clientId,
  });
}
