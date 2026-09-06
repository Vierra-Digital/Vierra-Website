import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, deleteSupabaseAuthUser, updateSupabaseAuthUserEmail } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { computePresenceStatus } from "@/lib/presence";

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
          // Derived, not read: sign-out and session-expiry paths write "offline" without
          // clearing last_active_at, so the stored word says offline for someone heartbeating
          // right now. lib/presence.ts is the same helper Staff Orbital and the dashboard use.
          status: computePresenceStatus(m.last_active_at),
          lastActiveAt: m.last_active_at ? m.last_active_at.toISOString() : null,
          clientName: u.clients_clients_user_idTousers?.name ?? null,
          hasPassword: false,
          isSelf: u.id === session.user.id,
        };
      });
      /**
       * Client accounts have a `clients` row but no company membership, so a membership-only
       * query listed staff and admins and quietly omitted every client — the page called "User
       * Management" showed a subset of users. Clients are appended with role "client" and the
       * same shape, so the table renders them without special-casing.
       */
      // Not scoped: a client belongs to its own company, so filtering by the caller's company
      // returned nothing at all. Role model v2 lets any Vierra staff member see every client,
      // the same rule /api/session/listClientSessions follows.
      const clients = await prisma.client.findMany({
        select: {
          id: true,
          user_id: true,
          name: true,
          email: true,
          business_name: true,
          company_id: true,
          companies: { select: { name: true } },
        },
      });
      // A client whose user_id already appears as a member would otherwise be listed twice.
      const memberUserIds = new Set(shaped.map((row) => row.id));
      const shapedClients = clients
        .filter((c) => !c.user_id || !memberUserIds.has(c.user_id))
        .map((c) => ({
          id: c.user_id ?? `client:${c.id}`,
          name: c.name,
          email: c.email,
          role: "client",
          position: c.business_name ?? null,
          country: null,
          company_email: null,
          mentor: null,
          strikes: 0,
          time_zone: null,
          status: "offline",
          lastActiveAt: null,
          clientName: c.name,
          companyName: c.companies?.name ?? null,
          isPlatformAdmin: false,
          hasPassword: false,
          isSelf: false,
          // Clients have no auth user until they accept an invite; the UI needs to know that a
          // row cannot be managed like a member before offering member-only actions on it.
          hasAccount: Boolean(c.user_id),
        }));

      /**
       * Last successful sign-in per user, in one round trip.
       *
       * DISTINCT ON is the point: login_attempts holds every attempt ever made, so fetching them
       * and reducing in JS would pull the whole history to pick one row per person. Postgres
       * returns the first row of each user_id group, and the ORDER BY decides which that is.
       */
      const everyone = [...shaped, ...shapedClients];
      const realUserIds = everyone.map((row) => row.id).filter((id) => !id.startsWith("client:"));
      const lastLogins = realUserIds.length
        ? await prisma.$queryRaw<Array<{ user_id: string; attempted_at: Date; ip_address: string | null }>>`
            SELECT DISTINCT ON (user_id) user_id, attempted_at, ip_address
            FROM login_attempts
            WHERE success = true AND user_id = ANY(${realUserIds}::uuid[])
            ORDER BY user_id, attempted_at DESC
          `
        : [];
      const loginByUser = new Map(lastLogins.map((row) => [row.user_id, row]));

      /**
       * Invitations that were sent and never accepted. They have no user row at all, so a page
       * listing users could not show them — someone invited a week ago was simply absent, with
       * nothing to say whether the invite had been sent.
       */
      const pendingInvites = await prisma.invitation.findMany({
        where: {
          accepted_at: null,
          company_id: companyId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          created_at: true,
          expires_at: true,
          companies: { select: { name: true } },
        },
        orderBy: { created_at: "desc" },
      });
      const nowForInvites = new Date();
      const shapedInvites = pendingInvites.map((invite) => ({
        id: `invite:${invite.id}`,
        name: null,
        email: invite.email,
        role: invite.role,
        position: null,
        country: null,
        company_email: null,
        mentor: null,
        strikes: 0,
        time_zone: null,
        status: "offline",
        lastActiveAt: null,
        clientName: null,
        companyName: invite.companies?.name ?? null,
        isPlatformAdmin: false,
        hasPassword: false,
        isSelf: false,
        hasAccount: false,
        lastLoginAt: null,
        lastLoginIp: null,
        pendingInvite: {
          id: invite.id,
          invitedAt: invite.created_at.toISOString(),
          expiresAt: invite.expires_at.toISOString(),
          expired: invite.expires_at.getTime() < nowForInvites.getTime(),
        },
      }));

      const withLogins = everyone.map((row) => {
        const login = loginByUser.get(row.id);
        return {
          ...row,
          lastLoginAt: login ? login.attempted_at.toISOString() : null,
          lastLoginIp: login?.ip_address ?? null,
          pendingInvite: null,
        };
      });

      return res.status(200).json([...withLogins, ...shapedInvites]);
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
      /**
       * A user belongs to a company through one of two tables, and this only ever looked at one.
       *
       * Staff have a company_memberships row; client accounts have a clients row and no
       * membership at all. Looking only at memberships meant every client came back "User not
       * found" — removal failed for exactly the accounts this page was extended to list.
       *
       * Both routes are checked. Scope and the admin guard follow role model v2: one fixed
       * company, and admins are removed elsewhere.
       */
      const target = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: {
          id: true,
          company_memberships_company_memberships_user_idTousers: { select: { company_id: true, role: true } },
          clients_clients_user_idTousers: { select: { company_id: true } },
        },
      });
      const membership = target?.company_memberships_company_memberships_user_idTousers ?? null;
      const clientRow = target?.clients_clients_user_idTousers ?? null;
      const belongs = membership?.company_id === companyId || Boolean(clientRow);
      // Same 404 as an unknown id: a caller with no business here learns nothing either way.
      if (!target || !belongs) return res.status(404).json({ message: "User not found" });
      if (membership?.role === "admin") {
        return res.status(403).json({ message: "Admin accounts can't be removed here." });
      }
      await prisma.client.updateMany({ where: { user_id: userId }, data: { user_id: null } });
      await prisma.user.delete({ where: { id: userId } });
      /**
       * The Auth identity has to go with the profile row. Deleting only public.users left the
       * account able to sign in against a user row that no longer exists, and kept the address
       * taken — which is why re-creating a removed person came back "Email already exists".
       *
       * Not fatal if it fails: the profile row is already gone and the caller's request
       * succeeded. Logged loudly, because what it leaves behind is exactly that orphan.
       */
      await deleteSupabaseAuthUser(String(userId)).catch((cleanupErr) =>
        console.error("admin/users DELETE: profile removed but auth user remains", userId, cleanupErr)
      );
      return res.status(200).json({ deleted: userId });
    } catch (e) {
      console.error("admin/users DELETE", e);
      return res.status(400).json({ message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
