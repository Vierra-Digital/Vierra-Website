import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/careersDrive", () => ({
  isCareersDriveConfigured: vi.fn(() => true),
  prepareApplicationUpload: vi.fn(async () => ({ sessions: [] })),
}));

import { prepareApplicationUpload } from "@/lib/careersDrive";
import handler from "@/pages/api/careers/apply";

const validApplicationPayload = {
  roleSlug: "SOFTWARE-ENGINEER-INTERN",
  fullName: " Jane Doe ",
  email: "JANE@EXAMPLE.COM",
  phoneNumber: "555.123.4567",
  currentLocation: " Boston, MA ",
  needRelocate: "Yes",
  usCitizen: "No",
  additionalNotes: "  Interested in reliable systems.  ",
  files: [
    { field: "resume", name: "resume.pdf", mimeType: "application/pdf", size: 1024 },
    { field: "coverLetter", name: "cover-letter.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 2048 },
  ],
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

describe("career application API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes valid fields before preparing the Drive upload", async () => {
    const response = makeResponse();

    await handler(makeRequest(validApplicationPayload, "career-valid-test"), response);

    expect(response.statusCode).toBe(200);
    expect(prepareApplicationUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSlug: "software-engineer-intern",
        detailsText: expect.stringContaining("Phone: (555) 123-4567"),
        description: expect.stringContaining("Needs relocation: Yes"),
      })
    );
  });

  it.each([
    ["missing location", { currentLocation: "" }],
    ["invalid email", { email: "not-an-email" }],
    ["short phone", { phoneNumber: "555123" }],
    ["invalid relocation enum", { needRelocate: "Maybe" }],
    ["invalid citizenship enum", { usCitizen: "sometimes" }],
    ["malformed role slug", { roleSlug: "Software Engineer" }],
    ["oversized notes", { additionalNotes: "x".repeat(2001) }],
  ])("rejects %s before opening a Drive upload", async (_label, override) => {
    const response = makeResponse();

    await handler(
      makeRequest({ ...validApplicationPayload, ...override }, `career-invalid-${Date.now()}-${_label}`),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(prepareApplicationUpload).not.toHaveBeenCalled();
  });

  it("silently accepts a filled honeypot without touching Drive", async () => {
    const response = makeResponse();

    await handler(makeRequest({ website: "bot-filled-this" }, "career-bot-test"), response);

    expect(response.statusCode).toBe(200);
    expect(prepareApplicationUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["unsupported extension", { files: [{ field: "resume", name: "resume.exe", size: 1024 }] }, "Files must be PDF, DOC, or DOCX."],
    ["oversized file", { files: [{ field: "resume", name: "resume.pdf", size: 25 * 1024 * 1024 + 1 }] }, "Each file must be under 25 MB."],
  ])("preserves the existing file guard for %s", async (_label, override, message) => {
    const response = makeResponse();

    await handler(
      makeRequest({ ...validApplicationPayload, ...override }, `career-file-${Date.now()}-${_label}`),
      response
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message });
    expect(prepareApplicationUpload).not.toHaveBeenCalled();
  });
});
