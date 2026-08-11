import { describe, it, expect } from "vitest";
import { toBase64Url, extractHeader, parseAddressFromHeader } from "@/lib/gmail/gmailApi";

describe("toBase64Url", () => {
  it("produces URL-safe base64 with no +, /, or = padding", () => {
    expect(toBase64Url("hi")).toBe("aGk");
    expect(toBase64Url("hello")).toBe("aGVsbG8");
    expect(toBase64Url("subjects>?ÿ")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("extractHeader", () => {
  const headers = [
    { name: "Subject", value: "Hello" },
    { name: "From", value: "Alex <a@x.com>" },
  ];
  it("looks up header values case-insensitively", () => {
    expect(extractHeader(headers, "subject")).toBe("Hello");
    expect(extractHeader(headers, "FROM")).toBe("Alex <a@x.com>");
  });
  it("returns empty string for a missing header or missing list", () => {
    expect(extractHeader(headers, "Reply-To")).toBe("");
    expect(extractHeader(undefined, "Subject")).toBe("");
  });
});

describe("parseAddressFromHeader", () => {
  it("extracts and lowercases the bare address from a Name <addr> header", () => {
    expect(parseAddressFromHeader("Alex Rivera <Alex@Acme.CO>")).toBe("alex@acme.co");
    expect(parseAddressFromHeader("BOB@X.COM")).toBe("bob@x.com");
    expect(parseAddressFromHeader("")).toBe("");
  });
  it("preserves case when lower:false", () => {
    expect(parseAddressFromHeader("Alex <Alex@Acme.CO>", { lower: false })).toBe("Alex@Acme.CO");
  });
});
