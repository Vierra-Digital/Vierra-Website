import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireRole(req, res);
  if (!session) return;

  const userId = session.user.id;

  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ message: "Email is required." });
    return;
  }

  try {
    const platform = `gmail:${email}`;
    const deleted = await prisma.platformToken.deleteMany({
      where: { user_id: userId, platform },
    });

    if (deleted.count === 0) {
      res.status(404).json({ message: "Gmail account token not found." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("gmail delete error", error);
    res.status(500).json({ message: "Failed to delete Gmail account." });
  }
}
