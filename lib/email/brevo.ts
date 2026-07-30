/**
 * Brevo transactional email API client. vierradev.com's SPF/DKIM/DMARC
 * (DMARC p=reject) are authenticated through Brevo, not Gmail — sending
 * system email via Gmail SMTP fails DMARC alignment and lands in spam.
 * Mirrors the working sender pattern already in use by the recruiting
 * routine (recruiting.py's `_send_via_brevo`).
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface BrevoAttachment {
  filename: string;
  content: Buffer;
}

export interface SendBrevoEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: BrevoAttachment[];
}

export function isBrevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY?.trim();
}

export async function sendBrevoEmail(input: SendBrevoEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

  const fromEmail = process.env.FROM_EMAIL || "alex@vierradev.com";
  const fromName = process.env.FROM_NAME || "Vierra";
  const toList = (Array.isArray(input.to) ? input.to : input.to.split(","))
    .map((e) => e.trim())
    .filter(Boolean);

  const payload: Record<string, unknown> = {
    sender: { email: fromEmail, name: fromName },
    to: toList.map((email) => ({ email })),
    subject: input.subject,
    htmlContent: input.html,
  };
  if (input.text) payload.textContent = input.text;
  if (input.replyTo) payload.replyTo = { email: input.replyTo };
  if (input.attachments?.length) {
    payload.attachment = input.attachments.map((a) => ({
      name: a.filename,
      content: a.content.toString("base64"),
    }));
  }

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}
