import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api/guards";
import type { ResolvedIdentity } from "@/lib/auth/resolveUser";

type SessionHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  session: ResolvedIdentity
) => unknown | Promise<unknown>;

interface WithSessionOptions {
  /** Allowed HTTP methods; a mismatch yields 405 with an Allow header. Omit to allow any. */
  methods?: string[];
  /** Label used in error logs (defaults to the request path). */
  scope?: string;
}

/**
 * Like `withAuth`, but authenticates ANY logged-in session (member, client, or
 * unaffiliated) via `requireSession` rather than requiring a company member.
 * Use for routes that intentionally serve client/"user" sessions; perform any
 * finer-grained role/kind checks inside the handler.
 *
 *   export default withSession(async (req, res, session) => { ... }, { methods: ["POST"] });
 */
export function withSession(handler: SessionHandler, options: WithSessionOptions = {}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      if (options.methods && (!req.method || !options.methods.includes(req.method))) {
        res.setHeader("Allow", options.methods);
        res.status(405).json({ message: "Method Not Allowed" });
        return;
      }

      const session = await requireSession(req, res);
      if (!session) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      await handler(req, res, session);
    } catch (error) {
      handleApiError(res, options.scope ?? req.url ?? "api", error);
    }
  };
}
