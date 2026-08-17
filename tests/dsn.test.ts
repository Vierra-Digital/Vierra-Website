import { describe, it, expect } from "vitest";
import { looksLikeBounce, parseDeliveryStatus, extractDsnParts, headerFromRaw } from "@/lib/gmail/dsn";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

describe("looksLikeBounce", () => {
  it("detects the authoritative multipart/report signal", () => {
    expect(looksLikeBounce({ "content-type": 'multipart/report; report-type=delivery-status; boundary="x"' }, "x@y.com")).toBe(true);
  });

  it("detects daemon senders", () => {
    expect(looksLikeBounce({}, "mailer-daemon@googlemail.com")).toBe(true);
    expect(looksLikeBounce({}, "postmaster@example.com")).toBe(true);
  });

  it("detects common bounce subjects", () => {
    expect(looksLikeBounce({ subject: "Undeliverable: Quick question" }, "a@b.com")).toBe(true);
    expect(looksLikeBounce({ subject: "Delivery Status Notification (Failure)" }, "a@b.com")).toBe(true);
  });

  it("ignores ordinary mail", () => {
    expect(looksLikeBounce({ "content-type": "text/html", subject: "Re: your proposal" }, "jane@acme.com")).toBe(false);
  });
});

describe("parseDeliveryStatus", () => {
  const report = [
    "Reporting-MTA: dns; mx.google.com",
    "",
    "Final-Recipient: rfc822; nobody@example.com",
    "Action: failed",
    "Status: 5.1.1",
    "Diagnostic-Code: smtp; 550-5.1.1 The email account does not exist.",
    "",
    "Final-Recipient: rfc822; busy@example.com",
    "Action: delayed",
    "Status: 4.2.2",
  ].join("\n");

  it("extracts each recipient with status and diagnostic", () => {
    const results = parseDeliveryStatus(report);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      email: "nobody@example.com",
      status: "5.1.1",
      action: "failed",
      permanent: true,
    });
    expect(results[0].diagnostic).toContain("does not exist");
  });

  it("marks 4.x.x as transient so a deferral never suppresses a contact", () => {
    const results = parseDeliveryStatus(report);
    expect(results[1]).toMatchObject({ email: "busy@example.com", status: "4.2.2", permanent: false });
  });

  it("skips the per-message block that names no recipient", () => {
    // "Reporting-MTA" block must not become a phantom recipient.
    expect(parseDeliveryStatus(report).every((r) => r.email.includes("@"))).toBe(true);
  });

  it("normalizes angle brackets and casing", () => {
    const results = parseDeliveryStatus("Final-Recipient: rfc822; <Nobody@Example.COM>\nStatus: 5.0.0");
    expect(results[0].email).toBe("nobody@example.com");
  });

  it("falls back to Action when Status is absent", () => {
    expect(parseDeliveryStatus("Final-Recipient: rfc822; x@y.com\nAction: failed")[0].permanent).toBe(true);
    expect(parseDeliveryStatus("Final-Recipient: rfc822; x@y.com\nAction: delayed")[0].permanent).toBe(false);
  });

  it("unfolds continuation lines", () => {
    const folded = "Final-Recipient: rfc822; x@y.com\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 no\n such user";
    expect(parseDeliveryStatus(folded)[0].diagnostic).toContain("such user");
  });

  it("handles CRLF line endings and empty input", () => {
    const crlf = "Final-Recipient: rfc822; a@b.com\r\nStatus: 5.1.1\r\n";
    expect(parseDeliveryStatus(crlf)[0].email).toBe("a@b.com");
    expect(parseDeliveryStatus("")).toEqual([]);
    expect(parseDeliveryStatus("   ")).toEqual([]);
  });

  it("uses Original-Recipient when Final-Recipient is missing", () => {
    expect(parseDeliveryStatus("Original-Recipient: rfc822; o@b.com\nStatus: 5.1.1")[0].email).toBe("o@b.com");
  });
});

describe("extractDsnParts", () => {
  it("pulls the delivery-status and original-headers parts out of a nested payload", () => {
    const payload = {
      mimeType: "multipart/report",
      parts: [
        { mimeType: "text/plain", body: { data: b64("Delivery failed") } },
        { mimeType: "message/delivery-status", body: { data: b64("Final-Recipient: rfc822; x@y.com\nStatus: 5.1.1") } },
        { mimeType: "message/rfc822", body: { data: b64("Message-ID: <abc@vierra>\nSubject: Hi") } },
      ],
    };
    const { deliveryStatus, originalHeaders } = extractDsnParts(payload);
    expect(deliveryStatus).toContain("5.1.1");
    expect(originalHeaders).toContain("abc@vierra");
  });

  it("returns empty strings when the parts are absent", () => {
    expect(extractDsnParts({ mimeType: "text/plain" })).toEqual({ deliveryStatus: "", originalHeaders: "" });
    expect(extractDsnParts(null)).toEqual({ deliveryStatus: "", originalHeaders: "" });
  });
});

describe("headerFromRaw", () => {
  it("reads a header case-insensitively and unfolds it", () => {
    expect(headerFromRaw("Subject: Hello\nMessage-ID: <a@b>", "message-id")).toBe("<a@b>");
    expect(headerFromRaw("Subject: Long\n  continued", "subject")).toBe("Long continued");
    expect(headerFromRaw("Subject: x", "to")).toBe("");
  });
});
