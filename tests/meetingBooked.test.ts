import { beforeEach, expect, it, vi } from "vitest";

/**
 * lib/campaigns/meetingBooked.ts used to read `contact.lead_status`, compare it to
 * "meeting_booked", and only then write — so two near-simultaneous calls for the same contact
 * (this function is shared by two separate booking-confirmation call paths, per its own doc
 * comment) could both read the same stale row, both pass the guard, and both log the event and
 * fire the Discord notification. It's now an atomic `updateMany` guarded on the transition itself;
 * only the caller that actually flips the row acts.
 */

const db = vi.hoisted(() => ({
  campaignContact: { findUnique: vi.fn(), updateMany: vi.fn() },
  leadStatusEvent: { create: vi.fn() },
  campaign: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const notifyMeetingBooked = vi.hoisted(() => vi.fn());
const discordConfigured = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/notify/discord", () => ({ notifyMeetingBooked, discordConfigured }));

import { markCampaignContactMeetingBooked } from "@/lib/campaigns/meetingBooked";

const CONTACT = {
  id: "contact-1",
  lead_status: "no_response",
  contact_email: "sam@example.com",
  contact_first_name: "Sam",
  contact_last_name: "Reed",
  campaign_id: "campaign-1",
};

beforeEach(() => {
  vi.resetAllMocks();
  discordConfigured.mockReturnValue(true);
  db.campaignContact.findUnique.mockResolvedValue(CONTACT);
  db.campaign.findUnique.mockResolvedValue({ name: "Q1 Outreach" });
});

it("logs the event and notifies when it wins the transition", async () => {
  db.campaignContact.updateMany.mockResolvedValue({ count: 1 });
  await markCampaignContactMeetingBooked("contact-1", "booking_confirmed");
  expect(db.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { id: "contact-1", lead_status: { not: "meeting_booked" } },
    data: { lead_status: "meeting_booked" },
  });
  expect(db.leadStatusEvent.create).toHaveBeenCalledOnce();
  expect(notifyMeetingBooked).toHaveBeenCalledOnce();
});

it("does nothing when it loses the race (another call already made the transition)", async () => {
  db.campaignContact.updateMany.mockResolvedValue({ count: 0 });
  await markCampaignContactMeetingBooked("contact-1", "booking_confirmed");
  expect(db.leadStatusEvent.create).not.toHaveBeenCalled();
  expect(notifyMeetingBooked).not.toHaveBeenCalled();
});

it("does nothing for a contact already at meeting_booked (no re-notify on a second booking)", async () => {
  db.campaignContact.findUnique.mockResolvedValue({ ...CONTACT, lead_status: "meeting_booked" });
  db.campaignContact.updateMany.mockResolvedValue({ count: 0 });
  await markCampaignContactMeetingBooked("contact-1", "booking_confirmed");
  expect(db.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { id: "contact-1", lead_status: { not: "meeting_booked" } },
    data: { lead_status: "meeting_booked" },
  });
  expect(notifyMeetingBooked).not.toHaveBeenCalled();
});

it("is best-effort: swallows an unexpected error rather than throwing into the booking flow", async () => {
  db.campaignContact.updateMany.mockRejectedValue(new Error("connection reset"));
  await expect(markCampaignContactMeetingBooked("contact-1", "booking_confirmed")).resolves.toBeUndefined();
});
