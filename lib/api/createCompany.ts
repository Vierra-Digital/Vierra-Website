import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
}

/**
 * Creates a new `companies` row, retrying with a numeric suffix on a slug collision — same
 * pattern as pages/api/onboarding/create-company.ts's self-service flow, factored out for reuse
 * by staff-initiated client creation (see docs/ROLE_MODEL_REDESIGN.md's "v2" section).
 */
export async function createCompanyWithSlug(name: string): Promise<{ id: string }> {
  const baseSlug = slugify(name);
  for (let attempt = 0; attempt <= 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    try {
      return await prisma.company.create({ data: { name: name.trim(), slug }, select: { id: true } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") continue; // slug collision, retry with a suffix
      throw error;
    }
  }
  throw new Error("Failed to create company (slug collision)");
}
