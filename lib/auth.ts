import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function requireSession(req: any, res: any) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return null;
  return session;
}

type SessionRole = "admin" | "staff" | "user";

/**
 * Authenticate (and optionally authorize by role) an API request. On failure this
 * sends the 401/403 response itself and returns null, so callers can simply:
 *   const session = await requireRole(req, res, ["admin", "staff"]);
 *   if (!session) return;
 * Omit `roles` to require only that the user is signed in.
 */
export async function requireRole(req: any, res: any, roles?: SessionRole[]) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  if (roles && roles.length > 0) {
    const role = (session.user as { role?: string })?.role;
    if (!role || !roles.includes(role as SessionRole)) {
      res.status(403).json({ message: "Forbidden" });
      return null;
    }
  }
  return session;
}
