import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/campaigns/[id].ts's status-transition PATCH — cancelling a campaign used to fire no
 * Discord notification at all (a comment there called this deliberate — "cancellation isn't
 * done, it's abandoned"). This pins the added notifyCampaignCancelled call, alongside the two
 * existing notifications (launched, completed) to make sure adding the third didn't disturb them.
 */

const db = vi.hoisted(() => ({
  campaign: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  campaignContact: { count: vi.fn() },
  campaignStep: { count: vi.fn() },
  emailOutboundMessage: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

const notifyCampaignCompleted = vi.hoisted(() => vi.fn());
const notifyCampaignLaunched = vi.hoisted(() => vi.fn());
const notifyCampaignCancelled = vi.hoisted(() => vi.fn());
const discordConfigured = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/notify/discord", () => ({
  notifyCampaignCompleted,
  notifyCampaignLaunched,
  notifyCampaignCancelled,
  discordConfigured,
}));
vi.mock("@/lib/campaigns/smartlead/client", () => ({
  createCampaign: vi.fn(),
  setCampaignSequence: vi.fn(),
  attachEmailAccount: vi.fn(),
  updateCampaignStatus: vi.fn(),
  smartleadConfigured: vi.fn(() => false),
  translateMergeTagsForSmartlead: (s: string) => s,
}));
vi.mock("@/lib/campaigns/brevo/client", () => ({ brevoConfigured: vi.fn(() => false) }));
vi.mock("@/lib/campaigns/preflight", () => ({ campaignPreflight: vi.fn(async () => ({ blockers: [] })) }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/campaigns/[id]";

const CAMPAIGN_ID = "campaign-1";

function campaignRow(status: string) {
  return {
    id: CAMPAIGN_ID,
    name: "Q1 Outreach",
    status,
    send_provider: "internal",
    smartlead_campaign_id: null,
    email_provider_accounts: { user_id: "user-1", account_email: "me@example.com", smartlead_email_account_id: null },
  };
}

async function call(status: string) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler(
    { method: "PATCH", query: { id: CAMPAIGN_ID }, body: { status } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  discordConfigured.mockReturnValue(true);
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.campaign.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...campaignRow(String(data.status)),
    _count: { campaign_steps: 1, campaign_contacts: 1 },
  }));
  db.campaignContact.count.mockResolvedValue(2);
  db.campaignStep.count.mockResolvedValue(1);
  db.emailOutboundMessage.count.mockResolvedValue(5);
});

it("notifies on cancellation, with the status it was cancelled from", async () => {
  db.campaign.findFirst.mockResolvedValue(campaignRow("active"));
  const res = await call("cancelled");
  expect(notifyCampaignCancelled).toHaveBeenCalledWith({
    campaignId: CAMPAIGN_ID,
    campaignName: "Q1 Outreach",
    fromStatus: "active",
    contactCount: 2,
  });
  expect(res.status).toHaveBeenCalledWith(200);
});

it("does not fire the cancelled notification for other transitions", async () => {
  db.campaign.findFirst.mockResolvedValue(campaignRow("active"));
  await call("paused");
  expect(notifyCampaignCancelled).not.toHaveBeenCalled();
});

it("still fires the launched notification on draft -> active", async () => {
  db.campaign.findFirst.mockResolvedValue(campaignRow("draft"));
  db.campaign.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...campaignRow(String(data.status)),
    _count: { campaign_steps: 1, campaign_contacts: 1 },
  }));
  await call("active");
  expect(notifyCampaignLaunched).toHaveBeenCalledWith({ campaignId: CAMPAIGN_ID, campaignName: "Q1 Outreach", contactCount: 2 });
  expect(notifyCampaignCancelled).not.toHaveBeenCalled();
});

it("still fires the completed notification on active -> completed", async () => {
  db.campaign.findFirst.mockResolvedValue(campaignRow("active"));
  await call("completed");
  expect(notifyCampaignCompleted).toHaveBeenCalledWith({
    campaignId: CAMPAIGN_ID,
    campaignName: "Q1 Outreach",
    sentCount: 5,
    contactCount: 2,
  });
  expect(notifyCampaignCancelled).not.toHaveBeenCalled();
});

it("skips all notifications when Discord isn't configured", async () => {
  discordConfigured.mockReturnValue(false);
  db.campaign.findFirst.mockResolvedValue(campaignRow("active"));
  await call("cancelled");
  expect(notifyCampaignCancelled).not.toHaveBeenCalled();
});
