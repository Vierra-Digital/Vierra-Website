import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { getMarketingYearlySummary } from "@/lib/marketingYearlySummary";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const userId = session.user.id;
  const year = req.query.year ? Number(req.query.year) : undefined;

  try {
    const rows = await getMarketingYearlySummary(userId, year);
    res.status(200).json({ summary: rows });
  } catch (e) {
    console.error("Error fetching marketing yearly summary:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
