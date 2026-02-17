import nodemailer from "nodemailer";

interface EmailData {
  fullName: string;
  email: string;
  phoneNumber: string;
  website: string;
  socialMedia: string;
  monthlyRevenue: string;
  desiredRevenue: string;
  startTimeline: string;
  agencyExperience: string;
  uniqueTraits: string;
  businessIssues: string;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

if (typeof process !== "undefined" && !process.env.EMAIL_USER) {
  console.warn("EMAIL_USER is not set. Email sending will fail.");
}
if (typeof process !== "undefined" && !process.env.EMAIL_PASS) {
  console.warn("EMAIL_PASS is not set. Email sending will fail.");
}

const recipients = ["alex@vierradev.com"];
const fromEmail = "business@alexshick.com";

export async function sendEmail(data: EmailData): Promise<void> {
  const formattedPhoneNumber = data.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");

  const mailOptions = {
    from: fromEmail,
    to: recipients.join(","),
    subject: "New Client Form Submission",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #18042A; color: #FFFFFF; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://vierradev.com/assets/vierra-logo.png" alt="Vierra Logo" style="width: 150px; height: auto;" />
        </div>
        <h2 style="color: #701CC0; text-align: center;">New Client Form Submission</h2>
        <p><strong>Full Name:</strong> ${data.fullName}</p>
        <p><strong>Email:</strong> <a href="mailto:${data.email}" style="color: #8F42FF; text-decoration: none;">${data.email}</a></p>
        <p><strong>Phone Number:</strong> <a href="tel:${formattedPhoneNumber}" style="color: #8F42FF; text-decoration: none;">${formattedPhoneNumber}</a></p>
        <p><strong>Website:</strong> <a href="${data.website}" target="_blank" style="color: #8F42FF; text-decoration: none;">${data.website}</a></p>
        <p><strong>Social Media:</strong> ${data.socialMedia}</p>
        <p><strong>Monthly Revenue:</strong> ${data.monthlyRevenue}</p>
        <p><strong>Desired Revenue:</strong> ${data.desiredRevenue}</p>
        <p><strong>Start Timeline:</strong> ${data.startTimeline}</p>
        <p><strong>Agency Experience:</strong> ${data.agencyExperience}</p>
        <p><strong>Unique Traits:</strong> ${data.uniqueTraits}</p>
        <p><strong>Business Issues:</strong> ${data.businessIssues}</p>
        <footer style="margin-top: 30px; text-align: center; border-top: 1px solid #701CC0; padding-top: 20px; color: #9BAFC3;">
          <p style="margin: 0;">© 2025 Vierra Digital Inc. All rights reserved.</p>
          <p style="margin: 0;">Visit us at <a href="https://vierradev.com" style="color: #8F42FF; text-decoration: none;">vierradev.com</a></p>
        </footer>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

function ensurePdfExtension(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

const signedEmailFooterHtml = `
  <div style="margin:40px 0 30px;text-align:center;">
    <a href="https://www.LinkedIn.com/company/Vierra" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/LinkedIn.png" alt="LinkedIn" style="width:32px;height:32px;">
    </a>
    <a href="https://www.instagram.com/vierra.dev" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/Instagram.png" alt="Instagram" style="width:32px;height:32px;">
    </a>
    <a href="https://www.facebook.com/share/1GXE6s4NSX/?mibextid=wwXIfr" style="margin:0 12px;display:inline-block;">
      <img src="https://vierradev.com/assets/Socials/Facebook.png" alt="Facebook" style="width:32px;height:32px;">
    </a>
  </div>
  <div style="color:#999;font-size:14px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;text-align:center;">
    Copyright &copy; ${new Date().getFullYear()} <a href="https://vierradev.com" style="color:#7A13D0;text-decoration:none;font-weight:600;">Vierra Digital</a>. All rights reserved.<br/>
    Contact: <a href="mailto:alex@vierradev.com" style="color:#999;text-decoration:none;">alex@vierradev.com</a>
  </div>
`;

export async function sendSignedDocumentEmail(documentName: string, attachment: Buffer): Promise<void> {
  const pdfFilename = ensurePdfExtension(documentName);
  const mailOptions = {
    from: fromEmail,
    to: recipients.join(","),
    subject: `Vierra | Signed Document: ${stripPdfExtension(documentName)}`,
    html: `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px;text-align:left;vertical-align:top;">
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Signed Document</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                The document "${documentName}" has been signed. See the signed version attached.
              </p>
              <div style="margin-bottom:40px;text-align:center;">
                <a href="cid:signedPdf" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 15px rgba(122,19,208,0.3);">
                  Download PDF
                </a>
              </div>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>
              ${signedEmailFooterHtml}
            </td>
          </tr>
        </table>
      </div>
    `,
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
    const info = await transporter.sendMail(mailOptions);
    console.log("Signed document email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending signed document email:", error);
  }
}

export async function sendSignerCopyEmail(email: string, documentName: string, attachment: Buffer): Promise<void> {
  const pdfFilename = ensurePdfExtension(documentName);
  const mailOptions = {
    from: fromEmail,
    to: email,
    subject: `Vierra | Signed Document: ${stripPdfExtension(documentName)}`,
    html: `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px;text-align:left;vertical-align:top;">
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Signed Document</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Thank you for signing "${documentName}" with Vierra. A copy is attached for your records.
              </p>
              <div style="margin-bottom:40px;text-align:center;">
                <a href="cid:signedPdf" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 15px rgba(122,19,208,0.3);">
                  Download PDF
                </a>
              </div>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>
              ${signedEmailFooterHtml}
            </td>
          </tr>
        </table>
      </div>
    `,
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
    const info = await transporter.sendMail(mailOptions);
    console.log(`Signed document copy sent to signer at ${email}:`, info.response);
  } catch (error) {
    console.error(`Error sending signed document copy to signer at ${email}:`, error);
    throw error;
  }
}

export async function sendStaffSetPasswordEmail(staffEmail: string, staffName: string, setPasswordLink: string): Promise<void> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const missing = [!process.env.EMAIL_USER && "EMAIL_USER", !process.env.EMAIL_PASS && "EMAIL_PASS"].filter(Boolean).join(", ");
    throw new Error(`Email not configured: ${missing} missing. Add them in your deployment environment (e.g. Vercel → Settings → Environment Variables).`);
  }
  const mailOptions = {
    from: fromEmail,
    to: staffEmail,
    subject: "Vierra | Set Your Password",
    html: `
      <div style="background:#f7f6fa;padding:32px 0;min-height:100vh;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);padding:40px 0;text-align:center;">
              <img src="https://vierradev.com/assets/vierra-logo.png" alt="Vierra logo" style="width: 140px; height: auto; padding-top: 4px; padding-left: 8px; padding-right: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:50px 40px;text-align:left;vertical-align:top;">
              <h2 style="font-size:28px;font-weight:700;color:#2e0a4f;margin:0 0 20px;line-height:1.3;">Set Your Password</h2>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Hi ${staffName || "there"}, you've been added to the Vierra team. Click the button below to set your password and log in. This link expires in 7 days.
              </p>
              <div style="margin-bottom:40px;text-align:center;">
                <a href="${setPasswordLink}" style="display:inline-block;background:linear-gradient(135deg, #7A13D0 0%, #9D4EDD 100%);color:#fff;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:10px;font-size:14px;box-shadow:0 4px 15px rgba(122,19,208,0.3);">
                  Set Password
                </a>
              </div>
              <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 40px;">Best Wishes,<br/>- The Vierra Team</p>
              ${signedEmailFooterHtml}
            </td>
          </tr>
        </table>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Set password email sent to ${staffEmail}:`, info.response);
  } catch (error) {
    console.error(`Error sending set password email to ${staffEmail}:`, error);
    throw error;
  }
}