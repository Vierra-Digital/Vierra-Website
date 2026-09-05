import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { safeCompare } from "./crypto.ts";
import { createServiceClient } from "./db.ts";

/**
 * Shared cron-secret gate for dispatch Edge Functions — mirrors the `x-cron-secret` check every
 * pages/api/**\/dispatch.ts route does today (see lib/crypto.ts's safeCompare usage), so
 * extensions.cron_dispatch_edge (prisma/manual/20260902_edge_fn_rpc_helpers.sql) can reuse the
 * exact same CRON_SECRET Vault value without any new auth mechanism.
 */
export async function requireCronSecret(req: Request): Promise<Response | null> {
  // Named "cron_secret" (lowercase), matching the Vault secret name from
  // 20260901_migrate_cron_to_pg_cron.sql — kept consistent across both secret stores.
  const secret = Deno.env.get("cron_secret") || "";
  const provided =
    req.headers.get("x-cron-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !(await safeCompare(provided, secret))) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }
  return null;
}

/**
 * Wraps a dispatch Edge Function's body with the method-check + requireCronSecret +
 * createServiceClient boilerplate every one of these functions repeated verbatim. Use as
 * `Deno.serve(withCronAuth(async (req, supabase) => { ... }))`.
 */
export function withCronAuth(
  handler: (req: Request, supabase: SupabaseClient) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET" && req.method !== "POST") {
      return Response.json({ message: "Method not allowed." }, { status: 405, headers: { Allow: "GET, POST" } });
    }
    const unauthorized = await requireCronSecret(req);
    if (unauthorized) return unauthorized;
    return handler(req, createServiceClient());
  };
}
