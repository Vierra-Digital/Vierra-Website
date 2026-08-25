import { describe, it, expect, vi, beforeEach } from "vitest";

// Both handlers are reachable from the public internet (middleware.ts skips /api/) and both perform
// privileged work, so the session check is the only thing standing in front of them. These tests
// exist so it cannot quietly go missing again.
const { requireRoleMock, sendBrevoEmail, isBrevoConfigured, sendMail, escapeHtml, formidableParse, saveSessionData } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn(),
    sendBrevoEmail: vi.fn(),
    isBrevoConfigured: vi.fn(),
    sendMail: vi.fn(),
    // Stands in for the real escaper (covered by its own tests) with a marker, so these tests
    // assert the handler routes the value through it rather than re-testing the escaping itself.
    escapeHtml: vi.fn((v: string) => `ESC(${v})`),
    formidableParse: vi.fn(),
    saveSessionData: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ requireRole: requireRoleMock, requireSession: vi.fn() }));
vi.mock("@/lib/email/brevo", () => ({ isBrevoConfigured, sendBrevoEmail }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("@/lib/gmail/sendCore", () => ({ escapeHtml }));
vi.mock("formidable", () => ({ default: () => ({ parse: formidableParse }) }));
vi.mock("@/lib/sessionStore", () => ({ saveSessionData }));

import sendSessionLinkEmail from "@/pages/api/sendSessionLinkEmail";
import generateSignLink from "@/pages/api/generateSignLink";

const STAFF = { kind: "member", user: { id: "u1", email: "s@x.com", role: "staff", name: null }, companyId: "c1" };

function mockRes() {
  const res: Record<string, unknown> & { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  res.setHeader = vi.fn(() => res);
  return res as unknown as { statusCode: number; body: unknown } & Record<string, ReturnType<typeof vi.fn>>;
}

const post = (body: unknown) => ({ method: "POST", body, headers: { host: "vierradev.com" }, query: {} }) as never;

/** The HTML the handler handed to whichever transport is configured. */
const sentHtml = () => String((sendBrevoEmail.mock.calls[0]?.[0] as { html: string })?.html ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(STAFF);
  isBrevoConfigured.mockReturnValue(true);
  sendBrevoEmail.mockResolvedValue(undefined);
  escapeHtml.mockImplementation((v: string) => `ESC(${v})`);
  process.env.NEXT_PUBLIC_APP_URL = "https://vierradev.com";
});

describe("sendSessionLinkEmail — panel-only", () => {
  it("sends nothing when there is no admin/staff session", async () => {
    // requireRole writes its own 401 and returns null; the handler must stop there. Without this
    // check anyone could send Vierra-branded mail from Vierra's address to any recipient.
    requireRoleMock.mockResolvedValue(null);
    await sendSessionLinkEmail(post({ email: "victim@example.com", link: "/session/abc" }), mockRes() as never);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects a malformed recipient without sending", async () => {
    const res = mockRes();
    await sendSessionLinkEmail(post({ email: "not-an-address", link: "/session/abc" }), res as never);
    expect(res.statusCode).toBe(400);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("rewrites an off-site link onto our own base", async () => {
    await sendSessionLinkEmail(post({ email: "c@example.com", link: "https://evil.example/phish" }), mockRes() as never);
    const html = sentHtml();
    expect(html).not.toContain("evil.example");
    expect(html).toContain('href="https://vierradev.com/phish"');
  });

  it("keeps a genuine relative session link intact", async () => {
    await sendSessionLinkEmail(post({ email: "c@example.com", link: "/session/abc123" }), mockRes() as never);
    expect(sentHtml()).toContain('href="https://vierradev.com/session/abc123"');
  });

  it("routes the client name through the escaper rather than the template", async () => {
    const name = '<img src=x onerror=alert(1)>';
    await sendSessionLinkEmail(post({ email: "c@example.com", link: "/session/abc", clientName: name }), mockRes() as never);
    expect(escapeHtml).toHaveBeenCalledWith(name);
    expect(sentHtml()).toContain(`ESC(${name})`);
  });

  it("still greets generically when no client name is given", async () => {
    await sendSessionLinkEmail(post({ email: "c@example.com", link: "/session/abc" }), mockRes() as never);
    expect(sentHtml()).toContain("Welcome To Vierra there!");
  });
});

describe("generateSignLink — panel-only", () => {
  it("does not read the upload when there is no admin/staff session", async () => {
    // Its sibling generateSignLinkFromPreset has always required this. Parsing must not even start:
    // an unauthenticated caller should not be able to mint a Vierra-branded signing link.
    requireRoleMock.mockResolvedValue(null);
    await generateSignLink({ method: "POST", headers: {}, query: {} } as never, mockRes() as never);
    expect(formidableParse).not.toHaveBeenCalled();
    expect(saveSessionData).not.toHaveBeenCalled();
  });

  it("rejects a non-POST method", async () => {
    const res = mockRes();
    await generateSignLink({ method: "GET", headers: {}, query: {} } as never, res as never);
    expect(res.statusCode).toBe(405);
    expect(formidableParse).not.toHaveBeenCalled();
  });
});
