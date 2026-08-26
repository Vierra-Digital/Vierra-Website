import { describe, expect, it } from "vitest";
import { jsonLd } from "@/lib/jsonLd";

// The escape sequence this helper emits, spelled out once: a literal backslash, then u003c.
const ESCAPED_LT = "\\u003c";

describe("jsonLd", () => {
  it("produces the same value once parsed", () => {
    const data = { "@type": "BlogPosting", headline: "Hello", tags: ["a", "b"], n: 1, ok: true };
    expect(JSON.parse(jsonLd(data))).toEqual(data);
  });

  it("escapes a closing script tag so it cannot end the block early", () => {
    const payload = "</script><img src=x onerror=alert(1)>";
    const out = jsonLd({ headline: payload });
    expect(out).not.toContain("</script");
    expect(out).toContain(`${ESCAPED_LT}/script`);
    // The value still round-trips to exactly what was written.
    expect(JSON.parse(out).headline).toBe(payload);
  });

  it("escapes an HTML comment opener", () => {
    const out = jsonLd({ headline: "<!--" });
    expect(out).not.toContain("<!--");
    expect(JSON.parse(out).headline).toBe("<!--");
  });

  it("escapes every < regardless of position, including nested and array values", () => {
    const out = jsonLd({ a: { b: ["<x>", "y"] }, "<key>": "<v>" });
    expect(out).not.toContain("<");
    const parsed = JSON.parse(out);
    expect(parsed.a.b[0]).toBe("<x>");
    expect(parsed["<key>"]).toBe("<v>");
  });

  it("leaves ordinary structured data untouched apart from <", () => {
    expect(jsonLd({ url: "https://vierradev.com/blog/x", name: "A & B" })).toBe(
      '{"url":"https://vierradev.com/blog/x","name":"A & B"}'
    );
  });

  it("would have caught a no-op replacement", () => {
    // Guards the exact bug the first implementation had: replacing < with the < character itself.
    expect(jsonLd({ x: "<" })).toBe(`{"x":"${ESCAPED_LT}"}`);
  });
});
