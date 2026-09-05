import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, deleteSupabaseAuthUser, updateSupabaseAuthUserEmail } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireRole(req, res);
  if (!session) return;
  const { companyId } = session;
  const userRole = session.user.role;
  const isAdmin = userRole === "admin";

  if (req.method === "GET") {
    if (userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      // Role model v2 (docs/ROLE_MODEL_REDESIGN.md): every company_memberships row is Vierra's
      // own team, all pointed at the same fixed company id — no cross-company bypass needed,
      // every caller's own companyId already is every other Vierra member's companyId too.
      const memberships = await prisma.companyMembership.findMany({
        where: { company_id: companyId },
        include: {
          users_company_memberships_user_idTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              user_preferences: { select: { time_zone: true, image_storage_key: true, image_updated_at: true } },
              clients_clients_user_idTousers: { select: { name: true } },
            },
          },
        },
        orderBy: { joined_at: "asc" },
      });

      const shaped = memberships
        // Admins are invisible to everyone except other admins — a regular staff member
        // shouldn't even know the account exists, let alone see it in the list.
        .filter((m) => isAdmin || m.role !== "admin")
        .map((m) => {
        const u = m.users_company_memberships_user_idTousers;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          image: Boolean(u.user_preferences?.image_storage_key),
          imageVersion: u.user_preferences?.image_updated_at
            ? u.user_preferences.image_updated_at.getTime()
            : u.user_preferences?.image_storage_key
              ? u.id
              : 0,
          role: m.role,
          position: m.position ?? null,
          country: null,
          company_email: null,
          mentor: m.mentor_id ?? null,
          strikes: m.strikes,
          time_zone: u.user_preferences?.time_zone ?? null,
          status: m.status,
          lastActiveAt: m.last_active_at ? m.last_active_at.toISOString() : null,
          clientName: u.clients_clients_user_idTousers?.name ?? null,
          hasPassword: false,
          isSelf: u.id === session.user.id,
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
    const { name, email, password } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }
    // role model v2: every company_memberships row created here is Vierra staff — "admin" is
    // never a settable role anywhere in the app (set only via direct database access, see
    // docs/ROLE_MODEL_REDESIGN.md), and client accounts aren't created here — they need a
    // `clients` row (business name, etc.) and are provisioned via Clients -> Add Client's
    // onboarding-link flow instead.
    const roleToStore = "staff";
    const normalizedEmail = String(email).trim().toLowerCase();

    let authUserId: string | undefined;
    try {
      const authUser = await createSupabaseAuthUser(normalizedEmail, password ? String(password) : undefined);
      authUserId = authUser.id;

      // The `on_auth_user_created` DB trigger already inserts a bare public.users row (id + email)
      // the instant createSupabaseAuthUser's insert into auth.users commits, so this always finds
      // a row waiting for it — upsert (fill in the name) rather than create (which would always
      // collide on the id and fail). The user row and its company membership must land together —
      // if the membership insert fails after the user row succeeds, we'd otherwise strand a user
      // with no company, invisible to this list (which is scoped by membership) and blocking
      // retry on this email.
      const [user] = await prisma.$transaction([
        prisma.user.upsert({
          where: { id: authUser.id },
          create: { id: authUser.id, name: name || null, email: normalizedEmail },
          update: { name: name || null, email: normalizedEmail },
          select: { id: true, name: true, email: true },
        }),
        prisma.companyMembership.create({
          data: { company_id: companyId, user_id: authUser.id, role: roleToStore },
        }),
      ]);
      return res.status(201).json({ ...user, role: roleToStore });
    } catch (e: any) {
      console.error("admin/users POST", e);
      if (authUserId) {
        // Roll back the Auth identity too, so a failed create doesn't strand an unreachable
        // account and permanently block re-creating this user with the same email.
        await deleteSupabaseAuthUser(authUserId).catch((cleanupErr) =>
          console.error("admin/users POST rollback failed", authUserId, cleanupErr)
        );
      }
      const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(",") : String(e?.meta?.target ?? "");
      const msg = e?.code === "P2002" && target.includes("email") ? "Email already exists" : "Failed to create user";
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
      // Gate the whole PUT on the target being a member of the caller's own (fixed Vierra)
      // company — one Vierra member can't edit a user id that isn't part of the team this way.
      const target = await prisma.companyMembership.findFirst({
        where: { company_id: companyId, user_id: String(id) },
        select: { user_id: true, company_id: true, role: true },
      });
      if (!target) return res.status(404).json({ message: "User not found" });
      const targetCompanyId = target.company_id;
      // An admin's own role can't be changed from here, by anyone (including another admin) —
      // "admin" is set only via direct database access (see docs/ROLE_MODEL_REDESIGN.md), never
      // through this endpoint. Other fields (name, email, position, time zone...) are unaffected.
      if (newRole !== undefined && target.role === "admin") {
        return res.status(403).json({ message: "Admin accounts can't have their role changed here." });
      }

      const normalizedEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;
      // Sync Supabase Auth first — if it fails, bail out before touching Prisma so the two
      // never disagree about which email is current (Supabase Auth is the login/reset source
      // of truth; see updateSupabaseAuthUserEmail).
      if (normalizedEmail !== undefined) {
        await updateSupabaseAuthUserEmail(String(id), normalizedEmail);
      }

      const userUpdateData: Record<string, unknown> = {};
      if (name !== undefined) userUpdateData.name = name;
      if (normalizedEmail !== undefined) userUpdateData.email = normalizedEmail;
      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({ where: { id: String(id) }, data: userUpdateData });
      }

      const memberUpdateData: Record<string, unknown> = {};
      // "admin" is never a settable value through this endpoint (see the is-target-already-admin
      // guard above) — any other requested role coerces to "staff", the only value this endpoint
      // may ever write.
      if (newRole) memberUpdateData.role = "staff";
      if (position !== undefined) memberUpdateData.position = position;
      if (mentor !== undefined) memberUpdateData.mentor_id = mentor;
      if (strikes !== undefined) memberUpdateData.strikes = strikes;
      if (Object.keys(memberUpdateData).length > 0) {
        await prisma.companyMembership.updateMany({
          where: { company_id: targetCompanyId, user_id: String(id) },
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
        where: { company_id: targetCompanyId, user_id: String(id) },
        select: { role: true, position: true, mentor_id: true, strikes: true, status: true, last_active_at: true },
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
        lastActiveAt: membership?.last_active_at ? membership.last_active_at.toISOString() : null,
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
    if (userId === session.user.id) {
      return res.status(400).json({ message: "You cannot remove your own account" });
    }
    try {
      // Only delete users who belong to the caller's own (fixed Vierra) company — never any
      // user id system-wide.
      const target = await prisma.companyMembership.findFirst({
        where: { company_id: companyId, user_id: String(userId) },
        select: { user_id: true, role: true },
      });
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.role === "admin") {
        return res.status(403).json({ message: "Admin accounts can't be removed here." });
      }
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
