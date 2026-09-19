import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ campaignStep: { count: vi.fn() }, campaignContact: { count: vi.fn() }, company: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { campaignPreflight } from "@/lib/campaigns/preflight";
beforeEach(() => { vi.resetAllMocks(); db.campaignStep.count.mockResolvedValue(1); db.campaignContact.count.mockResolvedValue(3); });
describe("campaign launch preflight", () => {
  it("uses the campaign company and reports missing internal sending prerequisites", async () => {
    db.company.findUnique.mockResolvedValue({ name: "Client A", mailing_address: "" });
    const result = await campaignPreflight({ id: "campaign", company_id: "client-a", send_provider: "internal" });
    expect(result.blockers.join(" ")).toContain("mailing address");
    expect(db.company.findUnique).toHaveBeenCalledWith({ where: { id: "client-a" }, select: { name: true, mailing_address: true } });
    expect(result.audience).toBe(3);
  });
  it("does not apply internal queue configuration to external providers", async () => {
    db.company.findUnique.mockResolvedValue({ name: "Client A", mailing_address: null });
    expect((await campaignPreflight({ id: "campaign", company_id: "client-a", send_provider: "brevo" })).blockers).toEqual([]);
  });
  it("blocks an empty sequence for every provider", async () => {
    db.campaignStep.count.mockResolvedValue(0);
    db.company.findUnique.mockResolvedValue(null);
    expect((await campaignPreflight({ id: "campaign", company_id: "client-a", send_provider: "smartlead" })).blockers).toContain("Add at least one sequence step before launching.");
  });
  it("blocks an empty audience for every provider — launching to nobody previously succeeded silently", async () => {
    db.campaignContact.count.mockResolvedValue(0);
    db.company.findUnique.mockResolvedValue({ name: "Client A", mailing_address: "123 Main St" });
    const result = await campaignPreflight({ id: "campaign", company_id: "client-a", send_provider: "brevo" });
    expect(result.audience).toBe(0);
    expect(result.blockers.join(" ")).toContain("Enroll at least one contact");
  });
});
