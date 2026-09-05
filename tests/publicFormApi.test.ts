import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/emailSender", () => ({
  sendEmail: vi.fn(async () => {}),
}));

import { sendEmail } from "@/lib/emailSender";
import handler from "@/pages/api/sendEmail";

const validAuditPayload = {
  fullName: " Jane Doe ",
  email: "JANE@EXAMPLE.COM",
  phoneNumber: "555.123.4567",
  website: "example.com/about?ref=api-test",
  monthlyRevenue: "$10k - $25k",
  desiredRevenue: "50000+",
};

function makeRequest(body: unknown, ip: string): NextApiRequest {
  return {
    method: "POST",
    body,
    headers: { "x-forwarded-for": ip },
    socket: { remoteAddress: ip },
  } as unknown as NextApiRequest;
}

function makeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
    setHeader: vi.fn(),
  };
  return response as unknown as NextApiResponse & typeof response;
}

describe("public audit API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("silently accepts a filled honeypot without sending email", async () => {
    const response = makeResponse();

    await handler(makeRequest({ company: "bot-filled-this" }, "audit-bot-test"), response);

    expect(response.statusCode).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid input before reaching the email layer", async () => {
    const response = makeResponse();

    await handler(
      makeRequest({ ...validAuditPayload, email: "not-an-email" }, "audit-invalid-test"),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("passes normalized legitimate input to the email operation", async () => {
    const response = makeResponse();

    await handler(makeRequest(validAuditPayload, "audit-valid-test"), response);

    expect(response.statusCode).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "(555) 123-4567",
      website: "https://example.com/about?ref=api-test",
      monthlyRevenue: "$10k - $25k",
      desiredRevenue: "$50,000+",
    });
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    const ip = `audit-rate-limit-${Date.now()}`;

    for (let i = 0; i < 5; i += 1) {
      const response = makeResponse();
      await handler(makeRequest({ ...validAuditPayload, email: "bad" }, ip), response);
      expect(response.statusCode).toBe(400);
    }

    const response = makeResponse();
    await handler(makeRequest(validAuditPayload, ip), response);
    expect(response.statusCode).toBe(429);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
