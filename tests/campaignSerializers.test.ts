import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STATUSES,
  LEAD_STATUSES,
  QUEUE_STATUSES,
  SEND_PROVIDERS,
  serializeCampaign,
  serializeCampaignContact,
  serializeCampaignStep,
  serializeLeadStatusEvent,
} from "@/lib/api/campaigns";

/**
 * These serializers are the contract between the Prisma rows and what the panel reads. They rename
 * every field from snake_case to camelCase, so a missed rename is not a type error on the server —
 * it is a field the panel reads as undefined and renders as blank.
 *
 * The defaults are the part worth pinning. Three different absent-value behaviours sit next to
 * each other, deliberately: null, false, and undefined. undefined omits the key from the JSON
 * entirely, which is right for a count the caller did not ask for and wrong for a boolean the UI
 * switches on.
 */

const DATES = {
  created: new Date("2026-01-01T00:00:00Z"),
  updated: new Date("2026-02-01T00:00:00Z"),
};

describe("the status vocabularies", () => {
  it("are non-empty and free of duplicates", () => {
    // A duplicate would make a filter chip appear twice; an empty list would disable filtering.
    for (const [name, list] of [
      ["CAMPAIGN_STATUSES", CAMPAIGN_STATUSES],
      ["SEND_PROVIDERS", SEND_PROVIDERS],
      ["LEAD_STATUSES", LEAD_STATUSES],
      ["QUEUE_STATUSES", QUEUE_STATUSES],
    ] as const) {
      expect(list.length, name).toBeGreaterThan(0);
      expect(new Set(list).size, name).toBe(list.length);
    }
  });

  it("keeps paused and skipped as distinct queue states", () => {
    // paused = held after a reply and manually resumable; skipped = permanently excluded
    // (DNC, hard bounce). Collapsing them would make a resumable contact unrecoverable.
    expect(QUEUE_STATUSES).toContain("paused");
    expect(QUEUE_STATUSES).toContain("skipped");
  });

  it("keeps the send providers that cannot change after launch", () => {
    expect(SEND_PROVIDERS).toEqual(["internal", "smartlead", "brevo"]);
  });
});

describe("serializeCampaign", () => {
  const row = {
    id: "c1",
    company_id: "co1",
    account_id: "acct1",
    created_by: "u1",
    name: "Q1 outreach",
    status: "active",
    send_provider: "internal",
    audience_filter: { source: "csv" },
    audience_synced_at: DATES.created,
    send_delay_seconds: 60,
    send_jitter_seconds: 15,
    daily_send_limit: 100,
    scheduled_start_at: null,
    started_at: DATES.created,
    completed_at: null,
    paused_at: null,
    created_at: DATES.created,
    updated_at: DATES.updated,
  };

  it("renames every field the panel reads", () => {
    const out = serializeCampaign(row);
    expect(out).toMatchObject({
      id: "c1",
      name: "Q1 outreach",
      status: "active",
      sendProvider: "internal",
      accountId: "acct1",
      createdBy: "u1",
      sendDelaySeconds: 60,
      sendJitterSeconds: 15,
      dailySendLimit: 100,
    });
    // company_id is deliberately not exposed — the panel scopes by session, not by a field.
    expect(out).not.toHaveProperty("company_id");
    expect(out).not.toHaveProperty("companyId");
  });

  it("gives accountEmail as null when there is no linked account", () => {
    expect(serializeCampaign(row).accountEmail).toBeNull();
    expect(serializeCampaign({ ...row, email_provider_accounts: null }).accountEmail).toBeNull();
    expect(
      serializeCampaign({ ...row, email_provider_accounts: { account_email: "a@b.co" } }).accountEmail
    ).toBe("a@b.co");
  });

  it("defaults enrollOnSignal to false, not undefined", () => {
    // The UI drives a toggle from this. undefined would drop the key from the JSON and leave the
    // control indeterminate rather than off.
    const out = serializeCampaign(row);
    expect(out.enrollOnSignal).toBe(false);
    expect(Object.hasOwn(out, "enrollOnSignal")).toBe(true);
    expect(serializeCampaign({ ...row, enroll_on_signal: true }).enrollOnSignal).toBe(true);
  });

  it("omits the counts entirely when they were not requested", () => {
    // undefined here is correct: the list endpoint asks for counts, the detail one does not, and
    // a zero would be indistinguishable from "genuinely none".
    const out = serializeCampaign(row);
    expect(out.stepCount).toBeUndefined();
    expect(out.contactCount).toBeUndefined();

    const counted = serializeCampaign({ ...row, _count: { campaign_steps: 3, campaign_contacts: 42 } });
    expect(counted.stepCount).toBe(3);
    expect(counted.contactCount).toBe(42);
  });

  it("passes a zero count through instead of treating it as absent", () => {
    const out = serializeCampaign({ ...row, _count: { campaign_steps: 0, campaign_contacts: 0 } });
    expect(out.stepCount).toBe(0);
    expect(out.contactCount).toBe(0);
  });

  it("keeps the audience filter as the opaque object it is", () => {
    expect(serializeCampaign(row).audienceFilter).toEqual({ source: "csv" });
  });
});

describe("serializeCampaignStep", () => {
  it("renames the override fields, keeping nulls as nulls", () => {
    const out = serializeCampaignStep({
      id: "s1",
      campaign_id: "c1",
      step_order: 2,
      name: "Follow-up",
      template_id: null,
      subject_override: "Re: hello",
      body_html_override: null,
      body_text_override: null,
      delay_days: 3,
      created_at: DATES.created,
      updated_at: DATES.updated,
    });
    expect(out).toMatchObject({
      id: "s1",
      campaignId: "c1",
      stepOrder: 2,
      subjectOverride: "Re: hello",
      delayDays: 3,
    });
    // An override that is absent must stay null, not become "" — the send path treats null as
    // "use the template" and "" as "send an empty subject".
    expect(out.bodyHtmlOverride).toBeNull();
    expect(out.templateId).toBeNull();
  });
});

describe("serializeCampaignContact", () => {
  it("renames the flattened contact fields and both statuses", () => {
    const out = serializeCampaignContact({
      id: "cc1",
      campaign_id: "c1",
      contact_id: "ct1",
      contact_email: "sam@acme.co",
      contact_first_name: "Sam",
      contact_last_name: null,
      contact_business: "Acme",
      assigned_to: null,
      current_step_id: "s1",
      lead_status: "positive_response",
      queue_status: "paused",
      skip_reason: null,
      enrolled_at: DATES.created,
      next_send_at: null,
      last_sent_at: DATES.created,
      completed_at: null,
      created_at: DATES.created,
      updated_at: DATES.updated,
    });
    expect(out).toMatchObject({
      contactEmail: "sam@acme.co",
      contactFirstName: "Sam",
      contactBusiness: "Acme",
      leadStatus: "positive_response",
      queueStatus: "paused",
      currentStepId: "s1",
    });
    expect(out.contactLastName).toBeNull();
    expect(out.skipReason).toBeNull();
  });
});

describe("serializeLeadStatusEvent", () => {
  const row = {
    id: "e1",
    campaign_contact_id: "cc1",
    from_status: "no_response",
    to_status: "positive_response",
    changed_by_user_id: "u1",
    changed_by_rule: "inbound_reply",
    note: "Auto-updated from an inbound reply.",
    created_at: DATES.created,
  };

  it("prefers the user's name for the audit line", () => {
    expect(
      serializeLeadStatusEvent({ ...row, users: { name: "Sam Reed", email: "sam@acme.co" } })
        .changedByUserName
    ).toBe("Sam Reed");
  });

  it("falls back to the email when the user has no name", () => {
    // Better an address than a blank row in the history.
    expect(
      serializeLeadStatusEvent({ ...row, users: { name: null, email: "sam@acme.co" } }).changedByUserName
    ).toBe("sam@acme.co");
  });

  it("gives null when there is no user at all, which is how a rule change looks", () => {
    expect(serializeLeadStatusEvent(row).changedByUserName).toBeNull();
    expect(serializeLeadStatusEvent({ ...row, users: null }).changedByUserName).toBeNull();
    // The rule is what identifies an automated change.
    expect(serializeLeadStatusEvent(row).changedByRule).toBe("inbound_reply");
  });

  it("keeps both ends of the transition, so the history reads as a change", () => {
    const out = serializeLeadStatusEvent(row);
    expect(out.fromStatus).toBe("no_response");
    expect(out.toStatus).toBe("positive_response");
  });
});
