import { describe, it, expect } from "vitest";
import { asPort, asQueryStr, asStr, isUuid, queryAccountEmail } from "@/lib/api/parsing";

describe("asStr", () => {
  it("trims strings and coerces non-strings to empty", () => {
    expect(asStr("  hi  ")).toBe("hi");
    expect(asStr("")).toBe("");
    expect(asStr(42)).toBe("");
    expect(asStr(null)).toBe("");
    expect(asStr(undefined)).toBe("");
    expect(asStr({})).toBe("");
  });
});

describe("asQueryStr", () => {
  it("takes the first element of an array and trims", () => {
    expect(asQueryStr(["  a ", "b"])).toBe("a");
    expect(asQueryStr("  x ")).toBe("x");
    expect(asQueryStr(undefined)).toBe("");
    expect(asQueryStr([])).toBe("");
  });
});

describe("asPort", () => {
  it("coerces to a positive integer, else falls back", () => {
    expect(asPort("443", 80)).toBe(443);
    expect(asPort(465, 25)).toBe(465);
    expect(asPort("8080.9", 80)).toBe(8080); // floored
    expect(asPort("nope", 587)).toBe(587);
    expect(asPort(0, 587)).toBe(587);
    expect(asPort(-1, 587)).toBe(587);
    expect(asPort(undefined, 993)).toBe(993);
  });
});

describe("queryAccountEmail", () => {
  it("trims and lowercases, first element of arrays", () => {
    expect(queryAccountEmail(["  Alex@Acme.CO "])).toBe("alex@acme.co");
    expect(queryAccountEmail("X@Y.com")).toBe("x@y.com");
    expect(queryAccountEmail(undefined)).toBe("");
  });
});

describe("isUuid", () => {
  /**
   * This exists to stop a malformed id reaching a `@db.Uuid` column, where Postgres rejects the
   * cast, Prisma raises P2007, and the route's catch turns a client mistake into a 500. Four public
   * routes did exactly that: /api/blog/image/abc answered 500 while the same route answered 404 for
   * a well-formed id that did not exist.
   */
  it("accepts a real uuid in either case", () => {
    expect(isUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isUuid("6BA7B810-9DAD-11D1-80B4-00C04FD430C8")).toBe(true);
    // The zero uuid is well-formed; it is used as a never-match sentinel elsewhere in the app.
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("rejects the shapes that were producing 500s", () => {
    for (const bad of ["abc", "", "x' OR 1=1--", "../../etc/passwd", "a".repeat(36)]) {
      expect(isUuid(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects near-misses rather than letting Postgres decide", () => {
    for (const bad of [
      "6ba7b810-9dad-11d1-80b4-00c04fd430c",    // one char short
      "6ba7b810-9dad-11d1-80b4-00c04fd430c89",  // one char long
      "6ba7b8109dad11d180b400c04fd430c8",       // no hyphens
      "6ba7b810-9dad-11d1-80b4-00c04fd430g8",   // non-hex
      " 6ba7b810-9dad-11d1-80b4-00c04fd430c8",  // leading space
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8\n", // trailing newline
    ]) {
      expect(isUuid(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});
