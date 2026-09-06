import { prisma } from "@/lib/prisma";

export async function campaignPreflight(campaign: { id: string; company_id: string; send_provider: string }) {
  const [steps, audience, company] = await Promise.all([
    prisma.campaignStep.count({ where: { campaign_id: campaign.id } }),
    prisma.campaignContact.count({ where: { campaign_id: campaign.id } }),
    prisma.company.findUnique({ where: { id: campaign.company_id }, select: { name: true, mailing_address: true } }),
  ]);
  const blockers: string[] = [];
  if (!steps) blockers.push("Add at least one sequence step before launching.");
  if (campaign.send_provider === "internal") {
    if (!company?.mailing_address?.trim()) blockers.push("Add the company's mailing address in Email Settings > Campaign sending.");
    const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "").replace(/\/$/, "");
    if (!/^https:\/\//i.test(site) && !(process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/i.test(site))) {
      blockers.push("The sending service needs a valid site URL for unsubscribe links. Contact an administrator.");
    }
  }
  return { companyName: company?.name || "Campaign company", steps, audience, blockers };
}
