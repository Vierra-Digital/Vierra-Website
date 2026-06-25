import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;
  const { companyId } = session;
  const userRole = session.user.role;

  if (req.method === "GET") {
    if (userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const memberships = await prisma.companyMembership.findMany({
        where: { company_id: companyId },
        include: {
          users_company_memberships_user_idTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              user_preferences: { select: { time_zone: true, image_storage_key: true } },
              clients_clients_user_idTousers: { select: { name: true } },
            },
          },
        },
        orderBy: { joined_at: "asc" },
      });

      const shaped = memberships.map((m) => {
        const u = m.users_company_memberships_user_idTousers;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          image: Boolean(u.user_preferences?.image_storage_key),
          role: m.role,
          position: m.position ?? null,
          country: null,
          company_email: null,
          mentor: m.mentor_id ?? null,
          strikes: m.strikes,
          time_zone: u.user_preferences?.time_zone ?? null,
          status: m.status,
          lastActiveAt: null,
          clientName: u.clients_clients_user_idTousers?.name ?? null,
          hasPassword: false,
        };
      });
      return res.status(200).json(shaped);
    } catch (e) {
      console.error("admin/users GET", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (userRole !== "admin") return res.status(403).json({ message: "Forbidden" });

  if (req.method === "POST") {
    const { name, email, password, role: newRole } = req.body ?? {};
    if (!email || !newRole) {
      return res.status(400).json({ message: "email and role are required" });
    }
    const roleToStore = String(newRole).toLowerCase() === "client" ? "staff" : String(newRole);
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const authUser = await createSupabaseAuthUser(normalizedEmail, password ? String(password) : undefined);
      const user = await prisma.user.create({
        data: { id: authUser.id, name: name || null, email: normalizedEmail },
        select: { id: true, name: true, email: true },
      });
      await prisma.companyMembership.create({
        data: { company_id: companyId, user_id: authUser.id, role: roleToStore },
      });
      return res.status(201).json({ ...user, role: roleToStore });
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
      mentor,
      time_zone,
      strikes,
    } = req.body ?? {};
    if (!id) return res.status(400).json({ message: "id is required" });
    try {
      const userUpdateData: Record<string, unknown> = {};
      if (name !== undefined) userUpdateData.name = name;
      if (email !== undefined) userUpdateData.email = email;
      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({ where: { id: String(id) }, data: userUpdateData });
      }

      const memberUpdateData: Record<string, unknown> = {};
      if (newRole) memberUpdateData.role = String(newRole).toLowerCase() === "client" ? "staff" : String(newRole);
      if (position !== undefined) memberUpdateData.position = position;
      if (mentor !== undefined) memberUpdateData.mentor_id = mentor;
      if (strikes !== undefined) memberUpdateData.strikes = strikes;
      if (Object.keys(memberUpdateData).length > 0) {
        await prisma.companyMembership.updateMany({
          where: { company_id: companyId, user_id: String(id) },
          data: memberUpdateData,
        });
      }

      if (time_zone !== undefined) {
        await prisma.userPreference.upsert({
          where: { user_id: String(id) },
          create: { user_id: String(id), time_zone: time_zone || null },
          update: { time_zone: time_zone || null },
        });
      }

      const updated = await prisma.user.findUnique({
        where: { id: String(id) },
        select: { id: true, name: true, email: true },
      });
      const membership = await prisma.companyMembership.findFirst({
        where: { company_id: companyId, user_id: String(id) },
        select: { role: true, position: true, mentor_id: true, strikes: true, status: true },
      });
      const pref = await prisma.userPreference.findUnique({
        where: { user_id: String(id) },
        select: { time_zone: true },
      });
      return res.status(200).json({
        ...updated,
        role: membership?.role ?? null,
        position: membership?.position ?? null,
        country: null,
        company_email: null,
        mentor: membership?.mentor_id ?? null,
        strikes: membership?.strikes ?? 0,
        time_zone: pref?.time_zone ?? null,
        status: membership?.status ?? null,
        lastActiveAt: null,
      });
    } catch (e) {
      console.error("admin/users PUT", e);
      return res.status(400).json({ message: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    const id = req.query.id || (req.body && req.body.id);
    const userId = Array.isArray(id) ? id[0] : id;
    if (!userId) return res.status(400).json({ message: "id is required" });
    try {
      await prisma.client.updateMany({ where: { user_id: userId }, data: { user_id: null } });
      await prisma.user.delete({ where: { id: userId } });
      return res.status(200).json({ deleted: userId });
    } catch (e) {
      console.error("admin/users DELETE", e);
      return res.status(400).json({ message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
