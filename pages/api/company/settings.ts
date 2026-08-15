import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Company-wide CAN-SPAM settings: a physical mailing address (required in every commercial
 * email) and an optional privacy-policy link. lib/campaigns/sendQueueTick.ts refuses to send a
 * single campaign message for a company until mailing_address is set — until this endpoint
 * existed there was no way to satisfy that guard at all, so no company could ever send a
 * campaign. Company-wide (not per-user): every member of the company shares one address.
 */
export default withAuth(async (req, res, session) => {
  if (req.method === "GET") {
    const company = await prisma.company.findUnique({
      where: { id: session.companyId },
      select: { mailing_address: true, privacy_policy_url: true },
    });
    res.status(200).json({
      mailingAddress: company?.mailing_address || "",
      privacyPolicyUrl: company?.privacy_policy_url || "",
    });
    return;
  }

  if (req.method === "PATCH") {
    const mailingAddress = asStr(req.body?.mailingAddress).trim();
    const privacyPolicyUrl = asStr(req.body?.privacyPolicyUrl).trim();
    const updated = await prisma.company.update({
      where: { id: session.companyId },
      data: {
        mailing_address: mailingAddress || null,
        privacy_policy_url: privacyPolicyUrl || null,
      },
      select: { mailing_address: true, privacy_policy_url: true },
    });
    res.status(200).json({
      mailingAddress: updated.mailing_address || "",
      privacyPolicyUrl: updated.privacy_policy_url || "",
    });
    return;
  }
}, { methods: ["GET", "PATCH"] });
