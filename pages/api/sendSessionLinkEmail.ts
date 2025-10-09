import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { email, link, clientName } = req.body ?? {};
  if (!email || !link) {
    return res.status(400).json({ message: "Missing email or link." });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Vierra Onboarding Session Link",
    html: `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px;text-align:center;vertical-align:top;">
              <div style="margin-bottom:30px;">
                <img src="https://vierradev.com/assets/Onboarding/Dove.png" alt="Dove" style="width:85px;height:85px;border-radius:50%;border:4px solid #0E0A2D;background:#6D5DD3;padding:20px;">
              </div>
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">
                Hi ${clientName || "there"}, Welcome To Vierra.<br/>Begin Your Onboarding
              </h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;max-width:480px;margin-left:auto;margin-right:auto;">
                We're excited to kick off our partnership! To get started, please connect your Stripe account for seamless automated payments. It takes just a few minutes to set up, and you'll be ready to roll with our services.
              </p>
              <div style="margin-bottom:20px;">
                <a href="${link.replace('/session/', '/session/onboarding/')}" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:18px;box-shadow:0 4px 15px rgba(122,19,208,0.3);transition:all 0.3s ease;">
                  Begin Onboarding
                </a>
              </div>
              <div style="margin-bottom:40px;">
                <a href="${link.replace('/session/', '/session/client/')}" style="display:inline-block;background:#fff;color:#7A13D0;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:12px;border:2px solid #7A13D0;font-size:16px;transition:all 0.3s ease;">
                  Begin Video Modules
                </a>
              </div>
              <div style="margin:40px 0 30px;">
                <a href="https://www.LinkedIn.com/company/Vierra" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/LinkedIn.png" alt="LinkedIn" style="width:32px;height:32px;">
                </a>
                <a href="https://www.instagram.com/vierra.dev" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/Instagram.png" alt="Instagram" style="width:32px;height:32px;">
                </a>
                <a href="https://www.facebook.com/share/1GXE6s4NSX/?mibextid=wwXIfr" style="margin:0 12px;display:inline-block;transition:transform 0.3s ease;">
                  <img src="https://vierradev.com/assets/Socials/Facebook.png" alt="Twitter" style="width:32px;height:32px;">
                </a>
              </div>
              <div style="color:#999;font-size:14px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;">
                Copyright &copy; 2025 Vierra Digital. All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "Email sent" });
  } catch (err: any) {
    console.error("Failed to send session link email:", err);
    return res.status(500).json({ message: "Failed to send email." });
  }
}

