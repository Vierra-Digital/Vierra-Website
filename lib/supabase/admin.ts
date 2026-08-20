import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for admin-only auth operations (creating users,
 * generating recovery links). Server-only — never import into client code.
 */

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Creates a Supabase Auth identity and returns it. `password` is optional —
 * omit it for invite-style flows where the user sets their own password later
 * via `supabase.auth.admin.updateUserById`. Always pre-confirms the email
 * since these are admin/server-initiated creations, not public signups.
 */
export async function createSupabaseAuthUser(email: string, password?: string) {
  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message || "Failed to create Supabase auth user");
  }
  return data.user;
}

/**
 * Deletes a Supabase Auth identity. Used to roll back a partially-failed
 * account creation (auth user created but the Prisma-side rows failed) and
 * when an admin deletes an app user, so the email isn't left permanently
 * stuck on an orphaned, unreachable Supabase identity. Errors are logged but
 * swallowed — callers use this as best-effort cleanup, not a critical path.
 */
export async function deleteSupabaseAuthUser(userId: string) {
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteSupabaseAuthUser", userId, error.message);
  }
}
