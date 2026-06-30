import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api/guards";
import type { ResolvedIdentity } from "@/lib/auth/resolveUser";

type SessionRole = "admin" | "staff";

/** Member session (kind === "member") — what requireRole resolves to on success. */
export type MemberSession = Extract<ResolvedIdentity, { kind: "member" }>;

type AuthedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: MemberSession
) => unknown | Promise<unknown>;

interface WithAuthOptions {
  /** Allowed HTTP methods; a mismatch yields 405 with an Allow header. Omit to allow any. */
  methods?: string[];
  /** Required member roles. Omit to require only that the user is a company member. */
  roles?: SessionRole[];
  /** Label used in error logs (defaults to the request path). */
  scope?: string;
}

/**
 * Wrap an API handler with the standard method-guard + member auth + error handling
 * that ~100 routes were re-implementing inline. The handler receives the resolved
 * member session as its third argument and can assume method/role are already valid.
 *
 *   export default withAuth(async (req, res, session) => { ... },
 *     { methods: ["GET", "POST"], roles: ["admin", "staff"] });
 */
export function withAuth(handler: AuthedHandler, options: WithAuthOptions = {}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      if (options.methods && (!req.method || !options.methods.includes(req.method))) {
        res.setHeader("Allow", options.methods);
        res.status(405).json({ message: "Method Not Allowed" });
        return;
      }

      const session = await requireRole(req, res, options.roles);
      if (!session) return; // requireRole already sent 401/403

      await handler(req, res, session as MemberSession);
    } catch (error) {
      handleApiError(res, options.scope ?? req.url ?? "api", error);
    }
  };
}
