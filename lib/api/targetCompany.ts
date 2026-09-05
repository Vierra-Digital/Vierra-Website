import type { NextApiRequest } from "next";
import type { MemberSession } from "@/lib/api/withAuth";
import type { ResolvedIdentity } from "@/lib/auth/resolveUser";

type ClientSession = Extract<ResolvedIdentity, { kind: "client" }>;

/**
 * Resolves which client company a request should act on (see docs/ROLE_MODEL_REDESIGN.md's "v2"
 * section, Phase 5). A representative (kind: "client") always acts on their own company —
 * anything they send is ignored. A Vierra staff member (kind: "member") no longer has an implicit
 * "own company" to act on (their session.companyId is always Vierra's fixed row now) — they must
 * name a target explicitly, and per the locked-in decision, any Vierra staff member may target
 * any client company, unrestricted (no per-staff assignment/ownership check).
 */
export function resolveTargetCompanyId(
  session: MemberSession | ClientSession,
  req: NextApiRequest
): string | null {
  if (session.kind === "client") return session.companyId;
  const raw = req.query.companyId ?? (req.body as Record<string, unknown> | undefined)?.companyId;
  return typeof raw === "string" && raw ? raw : null;
}
