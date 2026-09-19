import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ campaignDailyStat: { aggregate: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { computeBounceStats, isConsumerDomain } from "@/lib/email/mailboxHealth";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("computeBounceStats", () => {
  it("scopes the aggregate to campaigns sent through this mailbox's account_id", async () => {
    db.campaignDailyStat.aggregate.mockResolvedValue({ _sum: { emails_sent: 200, bounces: 4 } });
    const result = await computeBounceStats("account-1");
    expect(db.campaignDailyStat.aggregate).toHaveBeenCalledWith({
      where: { campaigns: { account_id: "account-1" } },
      _sum: { emails_sent: true, bounces: true },
    });
    expect(result).toEqual({ sent: 200, bounces: 4, rate: 0.02 });
  });

  it("reports no rate (not a divide-by-zero NaN or 0%) when the mailbox has never sent", async () => {
    db.campaignDailyStat.aggregate.mockResolvedValue({ _sum: { emails_sent: null, bounces: null } });
    const result = await computeBounceStats("account-2");
    expect(result).toEqual({ sent: 0, bounces: 0, rate: null });
  });

  it("computes a zero rate distinctly from no-data when sends exist but nothing bounced", async () => {
    db.campaignDailyStat.aggregate.mockResolvedValue({ _sum: { emails_sent: 50, bounces: 0 } });
    const result = await computeBounceStats("account-3");
    expect(result).toEqual({ sent: 50, bounces: 0, rate: 0 });
  });
});

describe("isConsumerDomain", () => {
  it("flags free consumer domains (Postmaster can never verify these)", () => {
    for (const domain of ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "aol.com"]) {
      expect(isConsumerDomain(domain)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isConsumerDomain("Gmail.COM")).toBe(true);
  });

  it("does not flag a custom sending domain", () => {
    expect(isConsumerDomain("vierradev.com")).toBe(false);
  });
});
