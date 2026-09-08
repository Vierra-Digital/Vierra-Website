import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * pages/api/campaigns/[id]/contacts/[contactId].ts's PATCH leadStatus branch used to read
 * `existing.lead_status` once, compare it to the new value, and only then write — the same race
 * as lib/campaigns/meetingBooked.ts (see tests/meetingBooked.test.ts): two concurrent PATCHes to
 * "meeting_booked" for the same contact could both pass the guard and both write the event / fire
 * the Discord notification, and a no-op resubmit (same status re-saved) still wrote a spurious
 * leadStatusEvent row even though the code explicitly guarded the *notification* against that
 * case. It's now an atomic `updateMany` guarded on the transition, matching the `claim` branch's
 * existing pattern in this same file.
 */

const db = vi.hoisted(() => ({
  campaign: { findFirst: vi.fn(), findUnique: vi.fn() },
  campaignContact: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  leadStatusEvent: { create: vi.fn(), findMany: vi.fn() },
  assignmentEvent: { create: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requireRole: vi.fn() }));

const addToDnc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/campaigns/dnc", () => ({ addToDnc }));

const notifyMeetingBooked = vi.hoisted(() => vi.fn());
const discordConfigured = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/notify/discord", () => ({ notifyMeetingBooked, discordConfigured }));

import { requireRole } from "@/lib/auth";
import handler from "@/pages/api/campaigns/[id]/contacts/[contactId]";

const CAMPAIGN_ID = "campaign-1";
const CONTACT_ID = "contact-1";
const existingContact = {
  id: CONTACT_ID,
  campaign_id: CAMPAIGN_ID,
  lead_status: "no_response",
  assigned_to: null,
  contact_email: "sam@example.com",
  contact_first_name: "Sam",
  contact_last_name: "Reed",
};

async function call(body: Record<string, unknown>) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler(
    { method: "PATCH", body, query: { id: CAMPAIGN_ID, contactId: CONTACT_ID } } as unknown as NextApiRequest,
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
  db.campaign.findFirst.mockResolvedValue({ id: CAMPAIGN_ID });
  db.campaign.findUnique.mockResolvedValue({ name: "Q1 Outreach" });
  db.campaignContact.findFirst.mockResolvedValue(existingContact);
  db.campaignContact.findUniqueOrThrow.mockResolvedValue({ ...existingContact, lead_status: "meeting_booked" });
});

it("logs the event and notifies when the transition actually happens", async () => {
  db.campaignContact.updateMany.mockResolvedValue({ count: 1 });
  const res = await call({ leadStatus: "meeting_booked" });
  expect(db.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { id: CONTACT_ID, lead_status: { not: "meeting_booked" } },
    data: { lead_status: "meeting_booked" },
  });
  expect(db.leadStatusEvent.create).toHaveBeenCalledOnce();
  expect(notifyMeetingBooked).toHaveBeenCalledOnce();
  expect(res.status).toHaveBeenCalledWith(200);
});

it("does nothing but still answers 200 when it loses a concurrent race to the same status", async () => {
  // Simulates the second of two concurrent PATCHes: the first request's updateMany already
  // flipped the row, so this one's WHERE (lead_status: { not: leadStatus }) matches nothing.
  db.campaignContact.updateMany.mockResolvedValue({ count: 0 });
  const res = await call({ leadStatus: "meeting_booked" });
  expect(db.leadStatusEvent.create).not.toHaveBeenCalled();
  expect(notifyMeetingBooked).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});

it("does not write a spurious event on a no-op resubmit of the current status", async () => {
  db.campaignContact.findFirst.mockResolvedValue({ ...existingContact, lead_status: "positive_response" });
  db.campaignContact.updateMany.mockResolvedValue({ count: 0 });
  await call({ leadStatus: "positive_response" });
  expect(db.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { id: CONTACT_ID, lead_status: { not: "positive_response" } },
    data: { lead_status: "positive_response" },
  });
  expect(db.leadStatusEvent.create).not.toHaveBeenCalled();
});

it("adds to DNC only when the transition to remove_contact actually wins", async () => {
  db.campaignContact.updateMany.mockResolvedValue({ count: 1 });
  await call({ leadStatus: "remove_contact" });
  expect(addToDnc).toHaveBeenCalledWith(CAMPAIGN_ID, existingContact.contact_email);
});

it("400s an unrecognized leadStatus without touching the database", async () => {
  const res = await call({ leadStatus: "definitely_not_a_status" });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.campaignContact.updateMany).not.toHaveBeenCalled();
});
