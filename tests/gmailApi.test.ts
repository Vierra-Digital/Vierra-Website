import { describe, it, expect, vi, beforeEach } from "vitest";
import { toBase64Url, extractHeader, parseAddressFromHeader, buildAliasScopeQuery, fetchSendAsAliases } from "@/lib/gmail/gmailApi";

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

describe("buildAliasScopeQuery", () => {
  it("ORs in deliveredto: for the inbound (to) direction, to survive header-rewriting forwards", () => {
    expect(buildAliasScopeQuery("business@alexshick.com", "to")).toBe(
      "(to:business@alexshick.com OR deliveredto:business@alexshick.com)"
    );
  });
  it("uses a plain from: filter for the outbound (sent/drafts) direction", () => {
    expect(buildAliasScopeQuery("business@alexshick.com", "from")).toBe("from:business@alexshick.com");
  });
});

describe("fetchSendAsAliases", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("keeps the primary plus any verified (accepted) alias, dropping unverified ones", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sendAs: [
            { sendAsEmail: "Alex@Vierradev.com", isPrimary: true },
            { sendAsEmail: "Business@AlexShick.com", verificationStatus: "accepted", displayName: "Alex" },
            { sendAsEmail: "unverified@alexshick.com", verificationStatus: "pending" },
          ],
        }),
    });
    const aliases = await fetchSendAsAliases("tok");
    expect(aliases).toEqual([
      { email: "alex@vierradev.com", displayName: "", isPrimary: true },
      { email: "business@alexshick.com", displayName: "Alex", isPrimary: false },
    ]);
  });

  it("returns an empty list on a failed request rather than throwing", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await fetchSendAsAliases("tok")).toEqual([]);
  });
});
