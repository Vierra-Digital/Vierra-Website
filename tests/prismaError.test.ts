import { describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { mapPrismaError } from "@/lib/api/prismaError";

/**
 * mapPrismaError backs handleApiError (lib/api/guards.ts), which every route wrapped in withAuth
 * funnels uncaught errors through — a regression here silently turns known, expected 4xx
 * conditions (a bad id, a name collision, a stale reference) back into generic 500s across the
 * whole API surface, not just wherever someone happens to notice.
 */

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("simulated", { code, clientVersion: "test", meta });
}

describe("mapPrismaError", () => {
  it("maps a unique-constraint violation to 409, naming the colliding field when Prisma reports one", () => {
    expect(mapPrismaError(prismaError("P2002", { target: ["email"] }))).toEqual({
      status: 409,
      message: "A record with that email already exists.",
    });
  });

  it("still returns a usable 409 when Prisma doesn't report which field collided", () => {
    expect(mapPrismaError(prismaError("P2002"))).toEqual({
      status: 409,
      message: "A record with that value already exists.",
    });
  });

  it("maps a foreign-key violation to 400", () => {
    expect(mapPrismaError(prismaError("P2003"))).toEqual({ status: 400, message: "Referenced record not found." });
  });

  it("maps record-not-found (update/delete on a row that's already gone) to 404", () => {
    expect(mapPrismaError(prismaError("P2025"))).toEqual({ status: 404, message: "Record not found." });
  });

  it("maps malformed identifiers/values (P2007, P2023) to 400", () => {
    expect(mapPrismaError(prismaError("P2007"))).toEqual({ status: 400, message: "Invalid identifier or value." });
    expect(mapPrismaError(prismaError("P2023"))).toEqual({ status: 400, message: "Invalid identifier or value." });
  });

  it("returns null for a Prisma code it doesn't recognize, so the caller's generic 500 still applies", () => {
    expect(mapPrismaError(prismaError("P2021"))).toBeNull();
  });

  it("returns null for anything that isn't a Prisma known-request error", () => {
    expect(mapPrismaError(new Error("boom"))).toBeNull();
    expect(mapPrismaError("boom")).toBeNull();
    expect(mapPrismaError(null)).toBeNull();
    expect(mapPrismaError(undefined)).toBeNull();
  });
});
