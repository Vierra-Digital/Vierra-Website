import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  // Allow staff and admin to read data, but only admin to modify data
  if (req.method === "GET") {
    if (role !== "admin" && role !== "staff") return res.status(403).json({ message: "Forbidden" });
  } else {
    if (role !== "admin") return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method === "GET") {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          passwordEnc: true,
          position: true,
          country: true,
          company_email: true,
          mentor: true,
          strikes: true,
          time_zone: true,
          status: true,
          lastActiveAt: true,
          client: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      });

      const shaped = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: Boolean(u.image),
        role: u.role ?? "user",
        position: u.position,
        country: u.country,
        company_email: u.company_email,
        mentor: u.mentor,
        strikes: u.strikes,
        time_zone: u.time_zone,
        status: u.status,
        lastActiveAt: u.lastActiveAt,
        clientName: u.client?.name ?? null,
        hasPassword: Boolean(u.passwordEnc),
      }));
      return res.status(200).json(shaped);
    } catch (e) {
      console.error("admin/users GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "POST") {
    const { name, email, password, role: newRole } = req.body ?? {};
    if (!email || !password || !newRole) {
      return res.status(400).json({ message: "email, password and role are required" });
    }
    // Normalize "client" to "user" (client is the UI label, user is the DB value)
    const roleToStore = String(newRole).toLowerCase() === "client" ? "user" : String(newRole);
    try {
      const created = await prisma.user.create({
        data: {
          name: name || null,
          email,
          role: roleToStore,
          passwordEnc: encrypt(String(password)),
        },
        select: { id: true, name: true, email: true, role: true },
      });
      return res.status(201).json(created);
    } catch (e: any) {
      console.error("admin/users POST", e);
      const msg = e?.code === "P2002" ? "Email already exists" : "Failed to create user";
      return res.status(400).json({ message: msg });
    }
  }

  if (req.method === "PUT") {
    const { 
      id, 
      name, 
      email,
      role: newRole, 
      position, 
      country, 
      company_email, 
      mentor, 
      time_zone, 
      strikes 
    } = req.body ?? {};
    if (!id) return res.status(400).json({ message: "id is required" });
    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (newRole) updateData.role = String(newRole).toLowerCase() === "client" ? "user" : String(newRole);
      if (position !== undefined) updateData.position = position;
      if (country !== undefined) updateData.country = country;
      if (company_email !== undefined) updateData.company_email = company_email;
      if (mentor !== undefined) updateData.mentor = mentor;
      if (time_zone !== undefined) updateData.time_zone = time_zone;
      if (strikes !== undefined) updateData.strikes = strikes;
      
      const updated = await prisma.user.update({
        where: { id: Number(id) },
        data: updateData,
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true,
          position: true,
          country: true,
          company_email: true,
          mentor: true,
          time_zone: true,
          strikes: true,
          status: true,
          lastActiveAt: true
        },
      });
      return res.status(200).json(updated);
    } catch (e) {
      console.error("admin/users PUT", e);
      return res.status(400).json({ message: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    const id = req.query.id || (req.body && req.body.id);
    const userId = Number(Array.isArray(id) ? id[0] : id);
    if (!userId) return res.status(400).json({ message: "id is required" });
    try {
      // Detach any client relation first to avoid FK issues
      await prisma.client.updateMany({ where: { userId: userId }, data: { userId: null } });
      await prisma.user.delete({ where: { id: userId } });
      return res.status(200).json({ deleted: userId });
    } catch (e) {
      console.error("admin/users DELETE", e);
      return res.status(400).json({ message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}


