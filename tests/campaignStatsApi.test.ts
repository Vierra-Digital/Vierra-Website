import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/campaigns/[id]/stats.ts's reply rate used to be `contactTotal - no_response count`,
 * i.e. "contacts not currently no_response" — which also counts contacts who exited via
 * sendQueueTick.ts's sequence-exhaustion auto-not_interested, or a bounce/unsubscribe/DNC removal,
 * neither of which involved an actual reply. It's now the real daily reply counter (the same
 * source opens/clicks/bounces/unsubscribes already use), summed and rated the same way as those.
 */

const db = vi.hoisted(() => ({
  campaign: { findFirst: vi.fn() },
  campaignDailyStat: { findMany: vi.fn() },
  campaignContact: { groupBy: vi.fn(), count: vi.fn() },
  campaignStep: { findMany: vi.fn() },
  emailOutboundMessage: { groupBy: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/campaigns/[id]/stats";

async function call(query: Record<string, unknown> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
  await handler({ method: "GET", query: { id: "campaign-1", ...query }, body: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    kind: "member",
    companyId: "company-1",
    user: { id: "user-1", role: "staff", email: "staff@example.com", name: null },
  } as never);
  db.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
  db.campaignStep.findMany.mockResolvedValue([]);
  db.emailOutboundMessage.groupBy.mockResolvedValue([]);
  db.emailOutboundMessage.findMany.mockResolvedValue([]);
});

it("computes reply rate from the daily reply counter, not from lead_status", async () => {
  // 10 contacts total; 6 no longer sit at no_response for reasons that have nothing to do with a
  // reply (4 auto-not_interested from sequence exhaustion, 2 removed via bounce/DNC) — the old
  // formula (contactTotal - no_response) would have reported these 6 as "replied".
  db.campaignContact.count.mockResolvedValueOnce(10); // contactTotal
  db.campaignContact.count.mockResolvedValueOnce(0); // bookedContacts
  db.campaignContact.groupBy.mockResolvedValue([
    { lead_status: "no_response", _count: 4 },
    { lead_status: "not_interested", _count: 4 },
    { lead_status: "remove_contact", _count: 2 },
  ]);
  // Only 1 real reply ever landed, yesterday (well within the default 7-day window).
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  db.campaignDailyStat.findMany.mockResolvedValue([
    { date: yesterday, emails_sent: 10, opens: 5, clicks: 1, replies: 1, bounces: 1, unsubscribes: 1 },
  ]);

  const res = await call();
  const payload = res.json.mock.calls[0][0];
  expect(payload.totals.replied).toBe(1);
  expect(payload.rates.replyRate).toBeCloseTo(1 / 10, 10);
});

it("reports zero reply rate when nothing has ever replied, even with plenty of status churn", async () => {
  db.campaignContact.count.mockResolvedValueOnce(5);
  db.campaignContact.count.mockResolvedValueOnce(0);
  db.campaignContact.groupBy.mockResolvedValue([
    { lead_status: "not_interested", _count: 3 },
    { lead_status: "remove_contact", _count: 2 },
  ]);
  db.campaignDailyStat.findMany.mockResolvedValue([
    { date: new Date(), emails_sent: 5, opens: 0, clicks: 0, replies: 0, bounces: 2, unsubscribes: 1 },
  ]);

  const res = await call();
  const payload = res.json.mock.calls[0][0];
  expect(payload.totals.replied).toBe(0);
  expect(payload.rates.replyRate).toBe(0);
});
