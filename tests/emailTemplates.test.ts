import { describe, it, expect, vi, beforeEach } from "vitest";

// Force the Brevo path (isBrevoConfigured -> true) and capture what deliver() sends,
// so we can assert on the rendered HTML without any network or SMTP transport.
vi.mock("@/lib/email/brevo", () => ({
  isBrevoConfigured: () => true,
  sendBrevoEmail: vi.fn(async () => {}),
}));

import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  sendEmail,
  sendAuditConfirmationEmail,
  sendSignedDocumentEmail,
  sendSignerCopyEmail,
  sendPasswordResetEmail,
  sendClientOnboardingCompletedEmail,
} from "@/lib/emailSender";

const mockSend = sendBrevoEmail as unknown as ReturnType<typeof vi.fn>;
const lastHtml = (): string => mockSend.mock.calls.at(-1)![0].html as string;

beforeEach(() => mockSend.mockClear());

// Every transactional email must carry the shared shell chrome.
function expectShell(html: string) {
  // Card table wrapper (now consistently full-width across all templates).
  expect(html).toContain(
    'style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);"'
  );
  // Header logo.
  expect(html).toContain('alt="Vierra logo"');
  expect(html).toContain("vierra-logo-panel.png");
  // Footer legal line + socials.
  expect(html).toContain("Vierra Digital</a>. All rights reserved.");
  expect(html).toContain('alt="LinkedIn"');
}

describe("transactional email templates", () => {
  it("sendEmail renders the audit-request summary inside the shell", async () => {
    await sendEmail({
      fullName: "Jane Doe",
      email: "jane@acme.test",
      phoneNumber: "5551234567",
      website: "https://acme.test",
      monthlyRevenue: "$10k",
      desiredRevenue: "$50k",
    });
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Audit Request");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("jane@acme.test");
    expect(html).toContain("555-123-4567"); // phone formatting preserved
    expect(html).toContain("https://acme.test");
  });

  it("sendAuditConfirmationEmail greets the lead by first name", async () => {
    await sendAuditConfirmationEmail({ fullName: "Jane Doe", email: "jane@acme.test" });
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Your Audit Request Has Been Claimed");
    expect(html).toContain("Hi Jane,");
  });

  it("sendSignedDocumentEmail includes a Download PDF button and attachment cid", async () => {
    await sendSignedDocumentEmail("Contract.pdf", Buffer.from("x"));
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Signed Document");
    expect(html).toContain('href="cid:signedPdf"');
    expect(html).toContain("Download PDF");
  });

  it("sendSignerCopyEmail thanks the signer and includes the CTA", async () => {
    await sendSignerCopyEmail("signer@acme.test", "Contract.pdf", Buffer.from("x"));
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Thank you for signing");
    expect(html).toContain("Download PDF");
  });

  it("sendPasswordResetEmail links the reset URL in the CTA", async () => {
    await sendPasswordResetEmail("user@acme.test", "Sam", "https://vierradev.com/reset?t=abc");
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Reset Your Password");
    expect(html).toContain('href="https://vierradev.com/reset?t=abc"');
    expect(html).toContain("Reset Password");
  });

  it("sendClientOnboardingCompletedEmail shows client details and the set-password CTA", async () => {
    await sendClientOnboardingCompletedEmail("client@acme.test", "Pat", "Acme Co", "https://vierradev.com/set?t=xyz");
    const html = lastHtml();
    expectShell(html);
    expect(html).toContain("Onboarding Complete");
    expect(html).toContain("Acme Co");
    expect(html).toContain('href="https://vierradev.com/set?t=xyz"');
  });
});
