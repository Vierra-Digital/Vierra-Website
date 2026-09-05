import { describe, expect, it } from "vitest";
import {
  normalizeAuditSubmission,
  normalizeEmailAddress,
  normalizeHttpUrl,
  normalizePhoneNumber,
} from "@/lib/publicFormValidation";

const validAudit = {
  fullName: "  Jane Doe  ",
  email: " JANE@Example.COM ",
  phoneNumber: "(555) 123-4567",
  website: "example.com/about?ref=free-audit",
  monthlyRevenue: "$10k - $25k",
  desiredRevenue: "50000+",
};

describe("public form normalization", () => {
  it("normalizes a complete audit submission", () => {
    expect(normalizeAuditSubmission(validAudit)).toEqual({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "(555) 123-4567",
      website: "https://example.com/about?ref=free-audit",
      monthlyRevenue: "$10k - $25k",
      desiredRevenue: "$50,000+",
    });
  });

  it("accepts valid email addresses and rejects malformed or oversized values", () => {
    expect(normalizeEmailAddress("  Jane@Example.COM ")).toBe("jane@example.com");
    expect(normalizeEmailAddress("not-an-email")).toBeNull();
    expect(normalizeEmailAddress("jane@example")).toBeNull();
    expect(normalizeEmailAddress(`${"a".repeat(250)}@example.com`)).toBeNull();
  });

  it("normalizes protocol-less URLs with paths and query strings", () => {
    expect(normalizeHttpUrl("example.com/about?ref=free-audit")).toBe(
      "https://example.com/about?ref=free-audit"
    );
    expect(normalizeHttpUrl("https://example.com/about?ref=free-audit")).toBe(
      "https://example.com/about?ref=free-audit"
    );
  });

  it("rejects non-HTTP schemes, malformed URLs, and oversized URLs", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeHttpUrl("not a URL")).toBeNull();
    expect(normalizeHttpUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });

  it("normalizes ten-digit phone numbers and rejects short or unsafe values", () => {
    expect(normalizePhoneNumber("555.123.4567")).toBe("(555) 123-4567");
    expect(normalizePhoneNumber("(555) 123-4567")).toBe("(555) 123-4567");
    expect(normalizePhoneNumber("555-123-456")).toBeNull();
    expect(normalizePhoneNumber("555-abc-4567")).toBeNull();
  });

  it("rejects incomplete, invalid, or oversized audit fields", () => {
    expect(normalizeAuditSubmission({ ...validAudit, monthlyRevenue: "not-an-option" })).toBeNull();
    expect(normalizeAuditSubmission({ ...validAudit, fullName: "x".repeat(101) })).toBeNull();
    expect(normalizeAuditSubmission({ ...validAudit, desiredRevenue: "x".repeat(33) })).toBeNull();
    expect(normalizeAuditSubmission({ ...validAudit, phoneNumber: "555123" })).toBeNull();
  });

});
