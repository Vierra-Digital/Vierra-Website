import type { NextApiRequest } from "next";
import type { MemberSession } from "@/lib/api/withAuth";
import type { ResolvedIdentity } from "@/lib/auth/resolveUser";
import { isUuid } from "@/lib/api/parsing";

type ClientSession = Extract<ResolvedIdentity, { kind: "client" }>;

/**
 * A well-formed (UUID-shaped) explicit companyId from the request, or null if none was given —
 * *or* if one was given but isn't UUID-shaped. `company_id` columns are `@db.Uuid`; handing
 * Postgres a non-UUID string throws (P2007) instead of a clean "not found," the same class of bug
 * isUuid()'s own doc comment (lib/api/parsing.ts) describes for id-in-URL routes. Treating a
 * malformed explicit value the same as "nothing named" — rather than passing it through to
 * whatever Prisma call eventually receives it — means every caller of resolveTargetCompanyId /
 * hasExplicitTargetCompanyId is shape-safe for free, without each one needing its own check.
 */
function explicitCompanyIdFromRequest(req: NextApiRequest): string | null {
  const raw = req.query.companyId ?? (req.body as Record<string, unknown> | undefined)?.companyId;
  return typeof raw === "string" && isUuid(raw) ? raw : null;
}

/**
 * Resolves which client company a request should act on (see docs/ROLE_MODEL_REDESIGN.md's "v2"
 * section, Phase 5). A representative (kind: "client") always acts on their own company —
 * anything they send is ignored. A Vierra staff member (kind: "member") may target any client
 * company, unrestricted (no per-staff assignment/ownership check) — but per-request tools like
 * Cartography and Contacts are also used for Vierra's own pipeline, not just client work, so with
 * no explicit target named this falls back to the staff member's own companyId, which is always
 * Vierra's fixed row (see lib/auth/vierraCompany.ts) rather than requiring an active-client pick
 * first just to use the tools on Vierra's own behalf.
 */
export function resolveTargetCompanyId(
  session: MemberSession | ClientSession,
  req: NextApiRequest
): string | null {
  if (session.kind === "client") return session.companyId;
  return explicitCompanyIdFromRequest(req) ?? session.companyId;
}

/**
 * Whether resolveTargetCompanyId's answer came from an explicit, well-formed choice — the request
 * naming a companyId, or a representative's session always meaning their own company — rather
 * than the staff no-target-named fallback to Vierra's own company above. A representative never
 * has a "look across every company" mode, so their session always counts as explicit.
 *
 * Contacts' GET list uses this to keep its own separate merged-view behavior: with nothing
 * picked (or something malformed named), a Vierra staff member browsing Contacts still sees every
 * client's contacts merged together (tagged with which company each came from) — that read-only
 * "see everything" view is a distinct feature from the Vierra-default write behavior above, which
 * needs a single concrete company to write into and can't write into "everything."
 */
export function hasExplicitTargetCompanyId(session: MemberSession | ClientSession, req: NextApiRequest): boolean {
  if (session.kind === "client") return true;
  return explicitCompanyIdFromRequest(req) !== null;
}
