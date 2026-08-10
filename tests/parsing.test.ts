import { describe, it, expect } from "vitest";
import { asStr, asQueryStr, asPort, queryAccountEmail } from "@/lib/api/parsing";

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
