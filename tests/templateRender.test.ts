import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/email/templateRender";

describe("renderTemplate — tokens", () => {
  it("substitutes {{token}} values", () => {
    expect(renderTemplate("Hi {{firstName}}", { firstName: "Alex" })).toBe("Hi Alex");
  });

  it("uses the |fallback when the value is missing or empty", () => {
    expect(renderTemplate("Hi {{firstName|there}}", { firstName: "" })).toBe("Hi there");
    expect(renderTemplate("Hi {{firstName|there}}", { firstName: null })).toBe("Hi there");
    expect(renderTemplate("Hi {{firstName|there}}", {})).toBe("Hi there");
  });

  it("renders empty when there is no value and no fallback", () => {
    expect(renderTemplate("Hi {{firstName}}", {})).toBe("Hi ");
  });

  it("returns empty string for empty input", () => {
    expect(renderTemplate("", { firstName: "Alex" })).toBe("");
  });
});

describe("renderTemplate — spintax", () => {
  it("picks exactly one option, deterministically per seed", () => {
    const opts = ["Hi", "Hey", "Hello"];
    const a = renderTemplate("{Hi|Hey|Hello}", {}, "seed-1");
    const b = renderTemplate("{Hi|Hey|Hello}", {}, "seed-1");
    expect(opts).toContain(a);
    expect(a).toBe(b); // same seed -> same variant
  });

  it("resolves tokens before spintax so tokens inside options work", () => {
    const out = renderTemplate("{Hi {{firstName}}|Hey {{firstName}}}", { firstName: "Alex" }, "s");
    expect(["Hi Alex", "Hey Alex"]).toContain(out);
  });

  it("leaves a padded pipe untouched (incidental prose, not spintax)", () => {
    expect(renderTemplate("Sizes: {small | large}", {})).toBe("Sizes: {small | large}");
  });
});
