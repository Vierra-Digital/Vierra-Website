import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Maps a Prisma error a route didn't specifically anticipate to the 4xx it actually represents —
 * a bad/malformed id, a name or unique-field collision, a stale foreign key, a row that's already
 * gone — so handleApiError's catch-all doesn't turn every one of these into a generic 500. This is
 * a safety net, not a substitute for validating input early (an isUuid() check before a Prisma
 * call still gives a clearer, field-specific message than the generic ones below).
 */
export function mapPrismaError(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    case "P2002": {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : undefined;
      return {
        status: 409,
        message: target ? `A record with that ${target} already exists.` : "A record with that value already exists.",
      };
    }
    case "P2003":
      return { status: 400, message: "Referenced record not found." };
    case "P2025":
      return { status: 404, message: "Record not found." };
    case "P2007":
    case "P2023":
      return { status: 400, message: "Invalid identifier or value." };
    default:
      return null;
  }
}
