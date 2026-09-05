import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { resolveBaseUrl, toSameSiteUrl } from "@/lib/api/url";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/email/brevo";
import { requireRole } from "@/lib/auth";
import { isValidEmail } from "@/lib/utils";
import { escapeHtml } from "@/lib/gmail/sendCore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  // Only ever called from the panel's Add Client flow, but nothing enforced that: the recipient,
  // the link and the client name all came straight from the request body, so anyone could have this
  // send mail from the company's own address to an arbitrary recipient with an arbitrary link in
  // the "Begin Onboarding" button — Vierra-branded phishing, on Vierra's sending reputation.
  const session = await requireRole(req, res, ["admin", "staff"]);
  if (!session) return;

  const { email, link, clientName } = req.body ?? {};
  if (!email || !link) {
    return res.status(400).json({ message: "Missing email or link." });
  }
  if (typeof email !== "string" || !isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email address." });
  }
  if (typeof link !== "string") {
    return res.status(400).json({ message: "Invalid onboarding link." });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    pool: false,
  } as nodemailer.TransportOptions);

  // Rebuilt on our own base so the emailed button can only ever point at this site. Previously an
  // absolute off-site URL passed straight through, and a malformed one fell back to the raw input.
  const fullLink = toSameSiteUrl(link, resolveBaseUrl(req));
  if (!fullLink) {
    return res.status(400).json({ message: "Invalid onboarding link." });
  }
  const fromEmail = process.env.FROM_EMAIL || "alex@vierradev.com";
  const fromName = process.env.FROM_NAME || "Vierra";
  const fromAddress = `"${fromName}" <${fromEmail}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: "Vierra | Onboarding Link",
    html: `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo-panel.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px;text-align:center;vertical-align:top;">
              <div style="margin-bottom:30px;">
                <img src="https://vierradev.com/assets/Onboarding/dove.png" alt="Dove" style="width:85px;height:85px;border-radius:50%;border:4px solid #0E0A2D;background:#6D5DD3;padding:20px;">
              </div>
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">
                Welcome To Vierra ${clientName ? escapeHtml(String(clientName)) : "there"}!
              </h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;max-width:480px;margin-left:auto;margin-right:auto;">
                We're excited to kick off our partnership! Click below to get started with your onboarding and video modules.
              </p>
              <div style="margin-bottom:40px;">
                <a href="${fullLink}" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:18px;box-shadow:0 4px 15px rgba(122,19,208,0.3);transition:all 0.3s ease;">
                  Begin Onboarding
                </a>
              </div>
              <div style="margin:40px 0 30px;">
                <a href="https://www.LinkedIn.com/company/Vierra" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/LinkedIn.png" alt="LinkedIn" style="width:32px;height:32px;">
                </a>
                <a href="https://www.instagram.com/vierra.dev" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/Instagram.png" alt="Instagram" style="width:32px;height:32px;">
                </a>
                <a href="https://www.facebook.com/vierradigital" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/Facebook.png" alt="Facebook" style="width:32px;height:32px;">
                </a>
              </div>
              <div style="color:#999;font-size:14px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;">
                Copyright &copy; ${new Date().getFullYear()} <a href="https://vierradev.com" style="color:#7A13D0;text-decoration:none;font-weight:600;">Vierra Digital</a>. All rights reserved.<br/>
                Contact: <a href="mailto:alex@vierradev.com" style="color:#999;text-decoration:none;">alex@vierradev.com</a>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };

  try {
    if (isBrevoConfigured()) {
      await sendBrevoEmail({ to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html });
    } else {
      await transporter.sendMail(mailOptions);
    }
    return res.status(200).json({ message: "Email sent" });
  } catch (err: any) {
    console.error("Failed to send session link email:", err);
    return res.status(500).json({ message: "Failed to send email." });
  }
}

