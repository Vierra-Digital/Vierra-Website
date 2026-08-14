/**
 * Brevo Transactional Email API client for "brevo"-provider campaign sends — see
 * .claude/schema_v2_campaigns_brevo_integration.md. Kept fully separate from lib/email/brevo.ts
 * (system auth/transactional email — unrelated, sends from a fixed FROM_EMAIL) so this stopgap
 * stays a self-contained, removable diff: campaign sends go out as the connected mailbox's own
 * address (account.account_email), per the chosen per-user-domain-verification sender model (§2),
 * not the fixed sender lib/email/brevo.ts uses.
 *
 * Env: BREVO_API_KEY (shared with lib/email/brevo.ts — same Brevo account).
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export function brevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

export type BrevoCampaignSendInput = {
  fromEmail: string;
  /** Display name shown alongside fromEmail — without this, mail clients show only the raw address. */
  fromName?: string;
  /**
   * Set to the same address as fromEmail on every send — not just belt-and-suspenders. Until
   * fromEmail is actually verified as a sender in Brevo's dashboard, Brevo silently proxies the
   * visible From through its own subdomain (observed: `<local>@<account-id>.brevosend.com`)
   * rather than rejecting the send, which would otherwise route replies nowhere useful.
   */
  replyTo: string;
  toEmail: string;
  subject: string;
  html: string;
  text?: string;
  /** Echoed back on the webhook — primary correlation key alongside the returned messageId. */
  tags: string[];
  /** Custom email headers, e.g. List-Unsubscribe/List-Unsubscribe-Post (RFC 8058). */
  headers?: Record<string, string>;
};

export type BrevoSendResult = { ok: true; messageId: string } | { ok: false; message: string };

export type BrevoSender = { email: string; name: string; active: boolean };
export type BrevoSendersResult = { ok: true; senders: BrevoSender[] } | { ok: false; message: string };

/** GET /v3/senders — every sender registered on this Brevo account, verified or not (active=verified). */
export async function listBrevoSenders(): Promise<BrevoSendersResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return { ok: false, message: "BREVO_API_KEY is not configured." };

  try {
    const res = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": apiKey, accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as { senders?: BrevoSender[]; message?: string };
    if (!res.ok) return { ok: false, message: data.message || `Brevo API error ${res.status}` };
    return { ok: true, senders: data.senders || [] };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Brevo request failed." };
  }
}

export async function sendBrevoCampaignEmail(input: BrevoCampaignSendInput): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return { ok: false, message: "BREVO_API_KEY is not configured." };

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: input.fromEmail, name: input.fromName || undefined },
        replyTo: { email: input.replyTo },
        to: [{ email: input.toEmail }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        tags: input.tags,
        headers: input.headers,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
    if (!res.ok) {
      return { ok: false, message: data.message || `Brevo API error ${res.status}` };
    }
    if (!data.messageId) {
      return { ok: false, message: "Brevo response missing messageId." };
    }
    return { ok: true, messageId: data.messageId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Brevo request failed." };
  }
}
