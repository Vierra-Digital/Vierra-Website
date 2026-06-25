import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ResolvedIdentity =
  | { kind: "member"; user: { id: string; email: string; role: string; name: string | null }; companyId: string }
  | { kind: "client"; user: { id: string; email: string; role?: undefined; name: string | null }; clientId: string; companyId: string }
  | { kind: "unaffiliated"; user: { id: string; email: string; role?: undefined; name: string | null } };

/**
 * Resolves a verified Supabase Auth user to a company member, a client, or
 * neither — through the Supabase client (RPC calls to the
 * `user_company_id()`/`user_company_role()`/`user_client_id()` SQL functions
 * already defined on the database), never through Prisma. Reads/RPCs run on
 * the caller's own per-request client (so `auth.uid()` resolves correctly and
 * RLS applies); the rare writes below (client backfill, invitation
 * auto-accept) need the service-role admin client, since a brand-new,
 * not-yet-affiliated user has no RLS path to create their own membership row.
 */
export async function resolveUser(supabase: SupabaseClient, authUser: SupabaseUser): Promise<ResolvedIdentity> {
  const email = authUser.email ?? "";

  const [{ data: nameRow }, { data: companyId }, { data: role }, { data: clientId }] = await Promise.all([
    supabase.from("users").select("name").eq("id", authUser.id).maybeSingle(),
    supabase.rpc("user_company_id"),
    supabase.rpc("user_company_role"),
    supabase.rpc("user_client_id"),
  ]);
  const name = (nameRow as { name: string | null } | null)?.name ?? null;

  if (companyId) {
    return {
      kind: "member",
      user: { id: authUser.id, email, role: role as string, name },
      companyId: companyId as string,
    };
  }

  if (clientId) {
    const { data: client } = await supabase.from("clients").select("company_id").eq("id", clientId).maybeSingle();
    return {
      kind: "client",
      user: { id: authUser.id, email, name },
      clientId: clientId as string,
      companyId: (client as { company_id: string } | null)?.company_id ?? "",
    };
  }

  if (!email) {
    return { kind: "unaffiliated", user: { id: authUser.id, email, name } };
  }

  const admin = getSupabaseAdmin();
  const normalizedEmail = email.toLowerCase();

  // Defensive fallback for clients created before this rewrite (no user_id
  // linked yet) — match by email and backfill via the admin client, since no
  // RLS policy can let an unlinked row be claimed by an anon-key request.
  const { data: unlinked } = await admin
    .from("clients")
    .select("id, company_id")
    .eq("email", normalizedEmail)
    .is("user_id", null)
    .maybeSingle();
  if (unlinked) {
    const row = unlinked as { id: string; company_id: string };
    await admin.from("clients").update({ user_id: authUser.id }).eq("id", row.id);
    return {
      kind: "client",
      user: { id: authUser.id, email, name },
      clientId: row.id,
      companyId: row.company_id,
    };
  }

  // Auto-accept a pending company invitation matching this email, if any.
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, company_id, role")
    .eq("email", normalizedEmail)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invitation) {
    const inv = invitation as { id: string; company_id: string; role: string };
    const { error: membershipError } = await admin
      .from("company_memberships")
      .insert({ company_id: inv.company_id, user_id: authUser.id, role: inv.role, status: "active" });
    if (!membershipError) {
      await admin.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
      return {
        kind: "member",
        user: { id: authUser.id, email, role: inv.role, name },
        companyId: inv.company_id,
      };
    }
  }

  return { kind: "unaffiliated", user: { id: authUser.id, email, name } };
}
