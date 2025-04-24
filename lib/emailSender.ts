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

export async function sendEmail(data: EmailData): Promise<void> {
  const formattedPhoneNumber = data.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const recipients = ["business@vierradev.com", "alex.shick@vierradev.com", "paul.wahba@vierradev.com"];

  const mailOptions = {
    from: process.env.EMAIL_USER,
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
