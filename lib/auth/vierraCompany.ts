import { prisma } from "@/lib/prisma";

const VIERRA_COMPANY_SLUG = "vierra";

/**
 * Resolves Vierra's own `companies` row (see docs/ROLE_MODEL_REDESIGN.md's "v2" section,
 * prisma/manual/20260906_role_model_v2_vierra_staff.sql) — every Vierra staff/admin
 * `company_memberships` row points at this one company. Identified purely by slug, no new
 * column. Memoized module-level: this never changes at runtime, so every caller after the
 * first shares one lookup instead of hitting the database on every request.
 */
let cached: Promise<string> | null = null;

export function getVierraCompanyId(): Promise<string> {
  if (!cached) {
    cached = prisma.company
      .findUniqueOrThrow({ where: { slug: VIERRA_COMPANY_SLUG }, select: { id: true } })
      .then((company) => company.id)
      .catch((error) => {
        // Don't cache a failure — a transient DB blip shouldn't permanently wedge every
        // staff login until the process restarts.
        cached = null;
        throw error;
      });
  }
  return cached;
}
