import { createSupabasePagesClient } from "@/lib/supabase/server";
import { resolveUser, type ResolvedIdentity } from "@/lib/auth/resolveUser";

export async function requireSession(req: any, res: any): Promise<ResolvedIdentity | null> {
  const supabase = createSupabasePagesClient(req, res);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return resolveUser(supabase, data.user);
}

type SessionRole = "admin" | "staff";

/**
 * Authenticate (and optionally authorize by role) an API request. On failure this
 * sends the 401/403 response itself and returns null, so callers can simply:
 *   const session = await requireRole(req, res, ["admin", "staff"]);
 *   if (!session) return;
 * Omit `roles` to require only that the user is a company member.
 */
export async function requireRole(req: any, res: any, roles?: SessionRole[]) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  if (session.kind !== "member") {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  if (roles && roles.length > 0) {
    const role = session.user.role;
    if (!role || !roles.includes(role as SessionRole)) {
      res.status(403).json({ message: "Forbidden" });
      return null;
    }
  }
  return session;
}

/** Authenticate a client-portal-only API request (kind === "client"). */
export async function requireClientSession(req: any, res: any) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  if (session.kind !== "client") {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return session;
}
