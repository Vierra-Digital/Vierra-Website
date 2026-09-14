import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { sendPasswordResetLink } from "@/lib/auth/passwordReset";
import { resolveBaseUrl } from "@/lib/api/url";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";
import { resolveBillingClient } from "@/lib/api/billingClient";

/**
 * Send a client a link to set their own password.
 *
 * Deliberately a reset link and not a password field, which is the same choice /api/admin/
 * userPassword already makes for staff. An admin typing a new password would mean knowing a
 * credential that is not theirs and handing it over out of band; a link is delivered to the
 * address on file and can only be used by whoever reads that inbox.
 *
 * /api/admin/userPassword cannot serve this: it looks the user up through a company_memberships
 * row in the ADMIN's own company, and a client's user is not a member of Vierra's.
 *
 * Admins only.
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const client = await resolveBillingClient({ kind: "member", companyId });
    if (!client) return res.status(404).json({ message: "No client for that company." });
    if (!client.user_id) {
      return res.status(400).json({ message: "This client has no login yet." });
    }

    const user = await prisma.user.findUnique({
      where: { id: client.user_id },
      select: { id: true, email: true, name: true },
    });
    if (!user) return res.status(404).json({ message: "This client has no login yet." });
    if (!user.email) return res.status(400).json({ message: "This client has no email on file." });

    try {
      await sendPasswordResetLink(user, resolveBaseUrl(req), false);
      return res.status(200).json({ message: `Password reset sent to ${user.email}.` });
    } catch (e) {
      console.error("client/password-reset", e);
      return res.status(502).json({ message: "Could not send the reset email." });
    }
  },
  { methods: ["POST"], roles: ["admin"] }
);
