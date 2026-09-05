import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Service-role Supabase client for dispatch Edge Functions — the Prisma replacement. No adapter-
 * pg, no Node `pg` driver: every DB call goes through PostgREST or an RPC (see
 * prisma/manual/20260902_edge_fn_rpc_helpers.sql for the Postgres-function side of this).
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into every Edge Function's env by
 * the platform — no `supabase secrets set` needed for these two.
 */
export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set in the function's environment.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
