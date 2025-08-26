import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Run a very simple query
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({ ok: true, message: "DB connection successful" });
  } catch (err: any) {
    console.error("DB health check failed:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });

    res.status(500).json({
      ok: false,
      message: "DB connection failed",
      error: err?.message || "Unknown error",
      code: err?.code,
    });
  }
}
