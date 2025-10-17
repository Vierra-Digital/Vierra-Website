import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  if (req.method === "GET") {
    try {
      const staff = await prisma.staff.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          passwordEnc: true,
          name: true,
          position: true,
          country: true,
          timeZone: true,
          phone: true,
          companyEmail: true,
          client: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      });

      const shaped = staff.map((s) => ({
        id: s.id,
        email: s.email,
        role: s.role ?? "staff",
        name: s.name,
        position: s.position,
        country: s.country,
        timeZone: s.timeZone,
        phone: s.phone,
        companyEmail: s.companyEmail,
        clientName: s.client?.name ?? null,
        hasPassword: Boolean(s.passwordEnc),
      }));
      return res.status(200).json(shaped);
    } catch (e) {
      console.error("admin/users GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "POST") {
    const { email, password, role: newRole } = req.body ?? {};
    if (!email || !password || !newRole) {
      return res.status(400).json({ message: "email, password and role are required" });
    }
    try {
      const created = await prisma.staff.create({
        data: {
          email,
          role: String(newRole),
          passwordEnc: encrypt(String(password)),
        },
        select: { id: true, email: true, role: true },
      });
      return res.status(201).json(created);
    } catch (e: any) {
      console.error("admin/users POST", e);
      const msg = e?.code === "P2002" ? "Email already exists" : "Failed to create user";
      return res.status(400).json({ message: msg });
    }
  }

  if (req.method === "PUT") {
    const { id, role: newRole } = req.body ?? {};
    if (!id || !newRole) return res.status(400).json({ message: "id and role are required" });
    try {
      const updated = await prisma.staff.update({
        where: { id: Number(id) },
        data: { role: String(newRole) },
        select: { id: true, email: true, role: true },
      });
      return res.status(200).json(updated);
    } catch (e) {
      console.error("admin/users PUT", e);
      return res.status(400).json({ message: "Failed to update role" });
    }
  }

  if (req.method === "DELETE") {
    const id = req.query.id || (req.body && req.body.id);
    const userId = Number(Array.isArray(id) ? id[0] : id);
    if (!userId) return res.status(400).json({ message: "id is required" });
    try {
      // Detach any client relation first to avoid FK issues
      await prisma.client.updateMany({ where: { staffId: userId }, data: { staffId: null } });
      await prisma.staff.delete({ where: { id: userId } });
      return res.status(200).json({ deleted: userId });
    } catch (e) {
      console.error("admin/users DELETE", e);
      return res.status(400).json({ message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}


