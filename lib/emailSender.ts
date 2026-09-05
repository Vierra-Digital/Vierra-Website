import nodemailer from "nodemailer";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/email/brevo";
import { escapeHtml } from "@/lib/utils";

export interface EmailData {
  fullName: string;
  email: string;
  phoneNumber: string;
  website: string;
  monthlyRevenue: string;
  desiredRevenue: string;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: false,
} as nodemailer.TransportOptions);

const recipients = ["alex@vierradev.com"];
const fromEmail = process.env.FROM_EMAIL || "alex@vierradev.com";
const fromName = process.env.FROM_NAME || "Vierra";
const fromAddress = `"${fromName}" <${fromEmail}>`;

interface DeliverOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string }[];
}

/**
 * Send through Brevo (authenticated for vierradev.com) when configured;
 * otherwise fall back to Gmail SMTP. Gmail-sent mail as an @vierradev.com
 * From address fails the domain's DMARC (p=reject) and lands in spam, so
 * Brevo is the correct path whenever BREVO_API_KEY is set.
 */
async function deliver(options: DeliverOptions): Promise<void> {
  if (isBrevoConfigured()) {
    await sendBrevoEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    return;
  }
  await transporter.sendMail({ from: fromAddress, ...options });
}

function ensurePdfExtension(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

// ---------------------------------------------------------------------------
// Shared transactional-email chrome. Every send function renders the same
// card shell (purple-gradient header + logo, white rounded card, social/legal
// footer) and only supplies its own body. Keeping these in one place means the
// branding lives in exactly one spot.
// ---------------------------------------------------------------------------

const emailHeaderRowHtml = `<tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo-panel.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>`;

const signedEmailFooterHtml = `
  <div style="margin:40px 0 30px;text-align:center;">
    <a href="https://www.LinkedIn.com/company/Vierra" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/LinkedIn.png" alt="LinkedIn" style="width:32px;height:32px;">
    </a>
    <a href="https://www.instagram.com/vierra.dev" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/Instagram.png" alt="Instagram" style="width:32px;height:32px;">
    </a>
    <a href="https://www.facebook.com/vierradigital" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/Facebook.png" alt="Facebook" style="width:32px;height:32px;">
    </a>
  </div>
  <div style="color:#999;font-size:14px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;">
    Copyright &copy; ${new Date().getFullYear()} <a href="https://vierradev.com" style="color:#7A13D0;text-decoration:none;font-weight:600;">Vierra Digital</a>. All rights reserved.<br/>
    Email: <a href="mailto:alex@vierradev.com" style="color:#999;text-decoration:none;">alex@vierradev.com</a>
  </div>
`;

/** Wrap a message body in the standard Vierra email card (header, card, footer). */
function renderEmailShell(bodyHtml: string): string {
  return `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          ${emailHeaderRowHtml}
          <tr>
            <td style="padding:50px 40px;text-align:left;vertical-align:top;">
              ${bodyHtml}
              ${signedEmailFooterHtml}
            </td>
          </tr>
        </table>
      </div>
    `;
}

/** The standard purple-gradient call-to-action button. */
function ctaButton(href: string, label: string): string {
  return `<div style="margin-bottom:40px;text-align:center;">
                <a href="${href}" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 15px rgba(122,19,208,0.3);">
                  ${label}
                </a>
              </div>`;
}

export async function sendEmail(data: EmailData): Promise<void> {
  const formattedPhoneNumber = escapeHtml(data.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3"));
  const fullName = escapeHtml(data.fullName);
  const email = escapeHtml(data.email);
  const website = escapeHtml(data.website);
  const monthlyRevenue = escapeHtml(data.monthlyRevenue);
  const desiredRevenue = escapeHtml(data.desiredRevenue);

  const mailOptions = {
    from: fromAddress,
    to: recipients.join(","),
    subject: "Vierra | New Client Form Submission",
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;text-align:left;">Audit Request</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;text-align:left;">A new lead just submitted the free audit request form:</p>
              <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;width:42%;">Full Name</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#444;font-size:15px;">${fullName}</td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;">Email</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;font-size:15px;"><a href="mailto:${email}" style="color:#7A13D0;text-decoration:none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;">Phone Number</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;font-size:15px;"><a href="tel:${formattedPhoneNumber}" style="color:#7A13D0;text-decoration:none;">${formattedPhoneNumber}</a></td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;">Website</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;font-size:15px;"><a href="${website}" target="_blank" style="color:#7A13D0;text-decoration:none;">${website}</a></td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;">Monthly Revenue</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#444;font-size:15px;">${monthlyRevenue}</td>
                </tr>
                <tr>
                  <td style="padding:11px 0;color:#2e0a4f;font-weight:700;font-size:15px;">Desired Revenue</td>
                  <td style="padding:11px 0;color:#444;font-size:15px;">${desiredRevenue}</td>
                </tr>
              </table>`),
  };

  try {
    await deliver(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Auto-reply confirmation sent to the lead who submitted the free audit form,
 * so they know it went through. Best-effort — callers should not fail the form
 * submission if this bounces (e.g. a mistyped address).
 */
export async function sendAuditConfirmationEmail(data: Pick<EmailData, "fullName" | "email">): Promise<void> {
  const firstName = (data.fullName || "").trim().split(/\s+/)[0] || "there";
  const safeFirstName = escapeHtml(firstName);
  const mailOptions = {
    from: fromAddress,
    to: data.email,
    subject: "Vierra | Audit Request Claimed",
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;text-align:left;">Your Audit Request Has Been Claimed</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 20px;text-align:left;">
                Hi ${safeFirstName}, congratulations! You have claimed your free business audit. Our team will be in touch within 24 hours to schedule your call.
              </p>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;text-align:left;">
                In the meantime, just reply to this email if there's anything you'd like us to know before we connect.
              </p>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;text-align:left;">Best Wishes,<br/>- The Vierra Team</p>`),
  };
  await deliver(mailOptions);
}

/**
 * Internal notification when a lead leaves a freeform availability note instead of finding an
 * open slot on the audit-call calendar (AuditBookingStep's no-slots fallback). `note` is
 * arbitrary user text going straight into an HTML email body — escaped via escapeHtml (same
 * helper the booking-confirmation emails use) so it can't break out of the markup or inject a
 * link/script into what sales reads. No database write happens anywhere in this path, so SQL
 * injection isn't a vector here; the HTML-injection one above is the applicable risk instead.
 */
export async function sendAuditAvailabilityNoteEmail(data: { fullName: string; email: string; note: string; context?: string }): Promise<void> {
  const mailOptions = {
    from: fromAddress,
    to: recipients.join(","),
    subject: "Vierra | Audit Call — Availability Note",
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;text-align:left;">Availability Note</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;text-align:left;">
                A lead didn't find an open slot on the audit-call calendar and left their availability instead:
              </p>
              <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#2e0a4f;font-weight:700;font-size:15px;width:42%;">Full Name</td>
                  <td style="padding:11px 0;border-bottom:1px solid #eee;color:#444;font-size:15px;">${escapeHtml(data.fullName)}</td>
                </tr>
                <tr>
                  <td style="padding:11px 0;${data.context ? "border-bottom:1px solid #eee;" : ""}color:#2e0a4f;font-weight:700;font-size:15px;">Email</td>
                  <td style="padding:11px 0;${data.context ? "border-bottom:1px solid #eee;" : ""}font-size:15px;"><a href="mailto:${escapeHtml(data.email)}" style="color:#7A13D0;text-decoration:none;">${escapeHtml(data.email)}</a></td>
                </tr>
                ${data.context ? `<tr>
                  <td style="padding:11px 0;color:#2e0a4f;font-weight:700;font-size:15px;">Context</td>
                  <td style="padding:11px 0;color:#444;font-size:15px;">${escapeHtml(data.context)}</td>
                </tr>` : ""}
              </table>
              <p style="color:#2e0a4f;font-weight:700;font-size:15px;margin:0 0 8px;">Their availability</p>
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 8px;white-space:pre-wrap;">${escapeHtml(data.note)}</p>`),
  };
  await deliver(mailOptions);
}

export async function sendSignedDocumentEmail(documentName: string, attachment: Buffer): Promise<void> {
  const pdfFilename = ensurePdfExtension(documentName);
  const mailOptions = {
    from: fromAddress,
    to: recipients.join(","),
    subject: `Vierra | Signed Document: ${stripPdfExtension(documentName)}`,
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Signed Document</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                The document "${documentName}" has been signed. See the signed version attached.
              </p>
              ${ctaButton("cid:signedPdf", "Download PDF")}
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>`),
    attachments: [
      {
        filename: pdfFilename,
        content: attachment,
        contentType: 'application/pdf',
        cid: 'signedPdf'
      }
    ]
  };

  try {
    await deliver(mailOptions);
    console.log("Signed document email sent successfully");
  } catch (error) {
    console.error("Error sending signed document email:", error);
  }
}

export async function sendSignerCopyEmail(email: string, documentName: string, attachment: Buffer): Promise<void> {
  const pdfFilename = ensurePdfExtension(documentName);
  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: `Vierra | Signed Document: ${stripPdfExtension(documentName)}`,
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Signed Document</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Thank you for signing "${documentName}" with Vierra. A copy is attached for your records.
              </p>
              ${ctaButton("cid:signedPdf", "Download PDF")}
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>`),
    attachments: [
      {
        filename: pdfFilename,
        content: attachment,
        contentType: 'application/pdf',
        cid: 'signedPdf'
      }
    ]
  };

  try {
    await deliver(mailOptions);
    console.log(`Signed document copy sent to signer at ${email}`);
  } catch (error) {
    console.error(`Error sending signed document copy to signer at ${email}:`, error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, name: string, resetLink: string): Promise<void> {
  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: "Vierra | Reset Your Password",
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Reset Your Password</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Hi ${name || "there"}, an admin requested a password reset for your Vierra account. Click the button below to set a new password. This link expires in 7 days.
              </p>
              ${ctaButton(resetLink, "Reset Password")}
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">If you didn't request this, you can safely ignore this email.<br/>- The Vierra Team</p>`),
  };

  try {
    await deliver(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`Error sending password reset email to ${email}:`, error);
    throw error;
  }
}

export async function sendClientOnboardingCompletedEmail(
  clientEmail: string,
  clientName: string,
  businessName: string,
  setPasswordLink: string
): Promise<void> {
  const mailOptions = {
    from: fromAddress,
    to: clientEmail,
    subject: "Vierra | Onboarding Complete",
    html: renderEmailShell(`
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Onboarding Complete</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">
                Hi ${clientName || "there"}, your onboarding modules are complete. The Vierra team will process your information shortly. The next step in the process is to log onto your account! Click on the reset password button to set your password.
              </p>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                <strong>Client Name:</strong> ${clientName || "N/A"}<br/>
                <strong>Business Name:</strong> ${businessName || "N/A"}<br/>
                <strong>Account Email:</strong> ${clientEmail}
              </p>
              ${ctaButton(setPasswordLink, "Reset Password")}
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>`),
  };

  try {
    await deliver(mailOptions);
    console.log(`Onboarding completion email sent to ${clientEmail}`);
  } catch (error) {
    console.error(`Error sending onboarding completion email to ${clientEmail}:`, error);
    throw error;
  }
}
