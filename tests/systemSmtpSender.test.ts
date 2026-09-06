import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

beforeEach(() => {
  vi.resetModules();
  sendMailMock.mockReset().mockResolvedValue({});
  createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
  delete process.env.SYSTEM_EMAIL_SMTP_APP_PASSWORD;
  process.env.SYSTEM_EMAIL_ACCOUNT = "michael@vierradev.com";
  process.env.FROM_NAME = "Vierra";
});

describe("sendSystemEmailViaSmtp", () => {
  it("throws when no app password is configured, without sending anything", async () => {
    const { sendSystemEmailViaSmtp } = await import("@/lib/email/systemSmtpSender");
    await expect(sendSystemEmailViaSmtp({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" })).rejects.toThrow(
      /SYSTEM_EMAIL_SMTP_APP_PASSWORD/
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends via smtp.gmail.com as the system mailbox once an app password is set", async () => {
    process.env.SYSTEM_EMAIL_SMTP_APP_PASSWORD = "app-pass";
    const { sendSystemEmailViaSmtp } = await import("@/lib/email/systemSmtpSender");
    await sendSystemEmailViaSmtp({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "michael@vierradev.com", pass: "app-pass" },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: '"Vierra" <michael@vierradev.com>',
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
  });
});
