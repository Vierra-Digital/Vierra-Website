import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { applyCors, requireExtensionAuth } from "@/lib/extension/auth";

/**
 * Token-authed list of the company's active clients, so the extension's
 * Settings can offer a "which client is this outreach for?" dropdown.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const ctx = requireExtensionAuth(req, res);
  if (!ctx) return;

  try {
    const clients = await prisma.client.findMany({
      where: { company_id: ctx.companyId, is_active: true },
      select: { id: true, name: true, business_name: true },
      orderBy: { business_name: "asc" },
    });
    res.status(200).json({
      clients: clients.map((c) => ({ id: c.id, name: c.business_name || c.name })),
    });
  } catch (e) {
    console.error("extension/clients error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
