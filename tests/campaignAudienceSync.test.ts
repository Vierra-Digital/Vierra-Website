import { beforeEach, expect, it, vi } from "vitest";

/**
 * lib/campaigns/audienceSync.ts's syncCampaignAudience — audience_filter used to only support
 * `tagIds`. This pins the added `contactIds` support: individually-picked contacts are additive
 * (a union) with the tag filter, not a replacement, and both still default to "everyone in the
 * company" when left empty. Also pins the isUuid defense against malformed ids stored in the
 * (JSON, not schema-validated) audience_filter column.
 */

const db = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn(), update: vi.fn() },
  campaignStep: { findFirst: vi.fn() },
  contact: { findMany: vi.fn() },
  campaignContact: { createMany: vi.fn(), updateMany: vi.fn() },
  emailBlockedSender: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/campaigns/smartlead/client", () => ({ addLeadsToCampaign: vi.fn() }));

import { syncCampaignAudience } from "@/lib/campaigns/audienceSync";

const CAMPAIGN_ID = "campaign-1";
const TAG_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
  db.campaignStep.findFirst.mockResolvedValue(null);
  db.contact.findMany.mockResolvedValue([]);
  db.campaignContact.createMany.mockResolvedValue({ count: 0 });
  db.campaign.update.mockResolvedValue({});
});

it("defaults to everyone in the company when the filter is empty", async () => {
  db.campaign.findUnique.mockResolvedValue({ id: CAMPAIGN_ID, company_id: "company-1", audience_filter: {} });
  await syncCampaignAudience(CAMPAIGN_ID);
  expect(db.contact.findMany).toHaveBeenCalledWith({
    where: { company_id: "company-1" },
    select: { id: true, email: true, first_name: true, last_name: true, business: true },
  });
});

it("unions tagIds and contactIds rather than requiring both", async () => {
  db.campaign.findUnique.mockResolvedValue({
    id: CAMPAIGN_ID,
    company_id: "company-1",
    audience_filter: { tagIds: [TAG_ID], contactIds: [CONTACT_ID] },
  });
  await syncCampaignAudience(CAMPAIGN_ID);
  expect(db.contact.findMany).toHaveBeenCalledWith({
    where: {
      company_id: "company-1",
      OR: [{ contact_tag_assignments: { some: { tag_id: { in: [TAG_ID] } } } }, { id: { in: [CONTACT_ID] } }],
    },
    select: { id: true, email: true, first_name: true, last_name: true, business: true },
  });
});

it("still matches on contactIds alone with no tags picked", async () => {
  db.campaign.findUnique.mockResolvedValue({
    id: CAMPAIGN_ID,
    company_id: "company-1",
    audience_filter: { tagIds: [], contactIds: [CONTACT_ID] },
  });
  await syncCampaignAudience(CAMPAIGN_ID);
  expect(db.contact.findMany).toHaveBeenCalledWith({
    where: { company_id: "company-1", OR: [{ id: { in: [CONTACT_ID] } }] },
    select: { id: true, email: true, first_name: true, last_name: true, business: true },
  });
});

it("drops a malformed contactId instead of letting it reach Prisma", async () => {
  db.campaign.findUnique.mockResolvedValue({
    id: CAMPAIGN_ID,
    company_id: "company-1",
    audience_filter: { contactIds: ["not-a-uuid", CONTACT_ID] },
  });
  await syncCampaignAudience(CAMPAIGN_ID);
  expect(db.contact.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { company_id: "company-1", OR: [{ id: { in: [CONTACT_ID] } }] } })
  );
});
