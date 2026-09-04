import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { InboundContext, InboundMessage } from "@/lib/gmail/inboundTypes";

/**
 * Every hook the inbound loop runs for each newly-arrived message. None of it was covered, and it
 * is the code path where a mistake is invisible: each hook is best-effort, so a wrong decision
 * silently does the wrong thing to a campaign contact rather than raising.
 *
 * Three properties here are worth more than the rest:
 *
 *   1. isAutomatedSender gates four of the seven hooks. It is what stops us auto-replying to a
 *      mailer-daemon and starting a mail loop.
 *   2. maybeReplyIntelligence and maybeRecordBounce must fail CLOSED when the mailbox has no
 *      resolvable provider account. Dropping the scope filter instead once let a reply match the
 *      most-recently-enrolled contact with that address across every tenant.
 *   3. A filter with no conditions must match nothing. `conds.length === 0 -> continue` is the
 *      only thing between an empty rule row and it applying to the user's whole inbox.
 *
 * lib/gmail/dsn and lib/campaigns/replyStatus are deliberately NOT mocked — both are tested, and
 * running the real ones means the bounce and lead-status cases below exercise the actual parsing.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailFilter: { findMany: vi.fn() },
    emailAccountSetting: { findUnique: vi.fn() },
    emailVacationResponseLog: { findUnique: vi.fn(), upsert: vi.fn() },
    emailAiPreference: { findUnique: vi.fn() },
    emailOutboundMessage: { findMany: vi.fn(), findFirst: vi.fn() },
    emailTrackingEvent: { create: vi.fn() },
    campaignContact: { findFirst: vi.fn(), update: vi.fn() },
    leadStatusEvent: { create: vi.fn() },
    campaign: { findUnique: vi.fn() },
    contact: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/gmail/gmailApi", () => ({
  modifyMessageLabels: vi.fn(),
  getOrCreateLabelId: vi.fn(),
  createGmailDraft: vi.fn(),
  gmailGet: vi.fn(),
}));
vi.mock("@/lib/api/emailAccounts", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/gmail/sendCore", () => ({ sendEmailCore: vi.fn() }));
vi.mock("@/lib/ai/artemis", () => ({ artemisGenerate: vi.fn(), artemisConfigured: vi.fn() }));
vi.mock("@/lib/notify/discord", () => ({
  notifyDiscordEmbed: vi.fn(),
  notifyCampaignReply: vi.fn(),
  discordConfigured: vi.fn(),
}));
vi.mock("@/lib/campaigns/dnc", () => ({ addToDnc: vi.fn() }));
vi.mock("@/lib/campaigns/campaignStats", () => ({ bumpCampaignStat: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createGmailDraft, getOrCreateLabelId, gmailGet, modifyMessageLabels } from "@/lib/gmail/gmailApi";
import { resolveAccountId } from "@/lib/api/emailAccounts";
import { sendEmailCore } from "@/lib/gmail/sendCore";
import { artemisConfigured, artemisGenerate } from "@/lib/ai/artemis";
import { discordConfigured, notifyCampaignReply, notifyDiscordEmbed } from "@/lib/notify/discord";
import { addToDnc } from "@/lib/campaigns/dnc";
import { bumpCampaignStat } from "@/lib/campaigns/campaignStats";
import {
  applyFilters,
  maybeAutoDraft,
  maybeHandleMdn,
  maybeNotifyDiscord,
  maybeRecordBounce,
  maybeReplyIntelligence,
  maybeSendVacationReply,
} from "@/lib/gmail/inboundActions";

const m = {
  filters: prisma.emailFilter.findMany as unknown as Mock,
  setting: prisma.emailAccountSetting.findUnique as unknown as Mock,
  vacLog: prisma.emailVacationResponseLog.findUnique as unknown as Mock,
  vacUpsert: prisma.emailVacationResponseLog.upsert as unknown as Mock,
  aiPref: prisma.emailAiPreference.findUnique as unknown as Mock,
  outMany: prisma.emailOutboundMessage.findMany as unknown as Mock,
  outFirst: prisma.emailOutboundMessage.findFirst as unknown as Mock,
  trackCreate: prisma.emailTrackingEvent.create as unknown as Mock,
  ccFirst: prisma.campaignContact.findFirst as unknown as Mock,
  ccUpdate: prisma.campaignContact.update as unknown as Mock,
  eventCreate: prisma.leadStatusEvent.create as unknown as Mock,
  campaign: prisma.campaign.findUnique as unknown as Mock,
  contact: prisma.contact.findFirst as unknown as Mock,
  labels: modifyMessageLabels as unknown as Mock,
  getLabel: getOrCreateLabelId as unknown as Mock,
  draft: createGmailDraft as unknown as Mock,
  get: gmailGet as unknown as Mock,
  account: resolveAccountId as unknown as Mock,
  send: sendEmailCore as unknown as Mock,
  aiOn: artemisConfigured as unknown as Mock,
  ai: artemisGenerate as unknown as Mock,
  discordOn: discordConfigured as unknown as Mock,
  embed: notifyDiscordEmbed as unknown as Mock,
  campaignPing: notifyCampaignReply as unknown as Mock,
  dnc: addToDnc as unknown as Mock,
  stat: bumpCampaignStat as unknown as Mock,
};

const NOW = new Date("2026-06-01T12:00:00Z");

const msg = (over: Partial<InboundMessage> = {}): InboundMessage => ({
  id: "m1",
  threadId: "t1",
  userId: "u1",
  accountEmail: "me@vierradev.com",
  from: "Sam Reed <sam@acme.co>",
  fromEmail: "sam@acme.co",
  to: "me@vierradev.com",
  subject: "Re: your note",
  snippet: "Sounds good, let us talk Thursday.",
  labelIds: ["INBOX", "UNREAD"],
  messageIdHeader: "<abc@acme.co>",
  inReplyTo: "<mine@vierradev.com>",
  headers: {},
  ...over,
});

const ctx = (over: Partial<InboundContext> = {}): InboundContext => ({
  accessToken: "tok",
  baseUrl: "https://vierradev.com",
  now: NOW,
  ...over,
});

const filter = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  user_id: "u1",
  enabled: true,
  account_email: null,
  from_contains: null,
  subject_contains: null,
  query_contains: null,
  match_type: "all",
  archive: false,
  mark_read: false,
  star: false,
  trash: false,
  add_label_id: null,
  add_label_name: null,
  ...over,
});

/** A Gmail `format=full` payload carrying a real RFC 3464 delivery-status part. */
function dsnPayload(body: string) {
  return {
    payload: {
      mimeType: "multipart/report",
      parts: [
        { mimeType: "text/plain", body: { data: Buffer.from("Delivery failed").toString("base64url") } },
        { mimeType: "message/delivery-status", body: { data: Buffer.from(body).toString("base64url") } },
      ],
    },
  };
}

const dsnFor = (email: string, status: string) =>
  dsnPayload(
    `Reporting-MTA: dns; mx.google.com\n\nFinal-Recipient: rfc822; ${email}\nAction: failed\nStatus: ${status}\nDiagnostic-Code: smtp; 550 no such user\n`
  );

/** Headers a real bounce arrives with. */
const BOUNCE_HEADERS = { "content-type": 'multipart/report; report-type=delivery-status; boundary="b"' };

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible "nothing configured, nothing found" baseline; each test opts in to what it needs.
  m.filters.mockResolvedValue([]);
  m.setting.mockResolvedValue(null);
  m.vacLog.mockResolvedValue(null);
  m.aiPref.mockResolvedValue(null);
  m.outMany.mockResolvedValue([]);
  m.outFirst.mockResolvedValue(null);
  m.ccFirst.mockResolvedValue(null);
  m.contact.mockResolvedValue(null);
  m.campaign.mockResolvedValue(null);
  m.account.mockResolvedValue("acct1");
  m.aiOn.mockReturnValue(false);
  m.discordOn.mockReturnValue(true);
  m.getLabel.mockResolvedValue("Label_1");
  m.send.mockResolvedValue({ ok: true });
  m.dnc.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ */
/* isAutomatedSender — the mail-loop guard, exercised through the hooks */
/* ------------------------------------------------------------------ */

describe("the automated-sender guard", () => {
  /** A mailbox with the vacation responder on and in-window; only the guard can stop the reply. */
  const responderOn = () =>
    m.setting.mockResolvedValue({
      id: "s1",
      vacation_responder_enabled: true,
      vacation_start_at: null,
      vacation_end_at: null,
      vacation_reply_frequency_hours: 24,
      vacation_subject: "Away",
      vacation_body_text: "Back Monday.",
      vacation_body_html: "",
    });

  const AUTOMATED: [string, Partial<InboundMessage>][] = [
    ["auto-submitted: auto-replied", { headers: { "auto-submitted": "auto-replied" } }],
    ["auto-submitted: auto-generated", { headers: { "auto-submitted": "auto-generated" } }],
    ["auto-submitted cased oddly", { headers: { "auto-submitted": "Auto-Generated" } }],
    ["precedence: bulk", { headers: { precedence: "bulk" } }],
    ["precedence: list", { headers: { precedence: "list" } }],
    ["precedence: junk", { headers: { precedence: "junk" } }],
    ["list-unsubscribe present", { headers: { "list-unsubscribe": "<mailto:x@y.co>" } }],
    ["list-id present", { headers: { "list-id": "<list.acme.co>" } }],
    ["from noreply@", { fromEmail: "noreply@acme.co" }],
    ["from no-reply@", { fromEmail: "no-reply@acme.co" }],
    ["from donotreply@", { fromEmail: "donotreply@acme.co" }],
    ["from do-not-reply@", { fromEmail: "do-not-reply@acme.co" }],
    ["from mailer-daemon@", { fromEmail: "mailer-daemon@acme.co" }],
    ["from postmaster@", { fromEmail: "postmaster@acme.co" }],
    ["from bounce@", { fromEmail: "bounce@acme.co" }],
    ["from MAILER-DAEMON@ uppercase", { fromEmail: "MAILER-DAEMON@acme.co" }],
  ];

  it.each(AUTOMATED)("never auto-replies to %s", async (_label, over) => {
    responderOn();
    await maybeSendVacationReply(msg(over), ctx());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("does reply to a normal human sender", async () => {
    responderOn();
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("treats `auto-submitted: no` as human, which is what the RFC means", async () => {
    // "no" is the explicit not-automated value. Reading any non-empty header as automated would
    // silence the responder for well-behaved senders.
    responderOn();
    await maybeSendVacationReply(msg({ headers: { "auto-submitted": "no" } }), ctx());
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("does not treat an address that merely contains 'bounce' as a daemon", async () => {
    // The pattern is anchored to the local part ending at "@", so a real person at a company
    // called Bounce still gets a reply.
    responderOn();
    await maybeSendVacationReply(msg({ fromEmail: "sam@bounce.co" }), ctx());
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("gates reply-intelligence and Discord on the same guard", async () => {
    const automated = msg({ headers: { precedence: "bulk" } });
    expect(await maybeReplyIntelligence(automated)).toBeNull();
    expect(m.ccFirst).not.toHaveBeenCalled();

    await maybeNotifyDiscord(automated);
    expect(m.embed).not.toHaveBeenCalled();
    expect(m.campaignPing).not.toHaveBeenCalled();
  });

  it("gates auto-draft on the same guard", async () => {
    m.aiOn.mockReturnValue(true);
    m.aiPref.mockResolvedValue({ autonomy: "autodraft", tone: "warm" });
    await maybeAutoDraft(msg({ headers: { "list-id": "<l>" } }), ctx());
    expect(m.draft).not.toHaveBeenCalled();
  });
});

/* --------------------------- */
/* applyFilters                */
/* --------------------------- */

describe("applyFilters", () => {
  it("touches nothing when the user has no filters", async () => {
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();
  });

  it("does not apply a filter that specifies no conditions", async () => {
    // An empty rule row must be inert. Treating "no conditions" as "matches everything" would
    // archive or trash the user's whole inbox on the next poll.
    m.filters.mockResolvedValue([filter({ archive: true, trash: true, mark_read: true })]);
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();
  });

  it("makes no API call when a filter matches but asks for nothing", async () => {
    m.filters.mockResolvedValue([filter({ subject_contains: "your note" })]);
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();
  });

  it("maps each action to the right label change", async () => {
    m.filters.mockResolvedValue([
      filter({ subject_contains: "your note", archive: true, mark_read: true, star: true, trash: true }),
    ]);
    await applyFilters(msg(), ctx());

    expect(m.labels).toHaveBeenCalledTimes(1);
    const [, id, body] = m.labels.mock.calls[0];
    expect(id).toBe("m1");
    expect(body.addLabelIds.sort()).toEqual(["STARRED", "TRASH"]);
    expect(body.removeLabelIds.sort()).toEqual(["INBOX", "UNREAD"]);
  });

  it("matches on the from header, the subject, and the combined haystack", async () => {
    for (const field of ["from_contains", "subject_contains", "query_contains"] as const) {
      vi.clearAllMocks();
      const needle = field === "from_contains" ? "acme.co" : field === "subject_contains" ? "your note" : "Thursday";
      m.filters.mockResolvedValue([filter({ [field]: needle, star: true })]);
      await applyFilters(msg(), ctx());
      expect(m.labels, field).toHaveBeenCalledTimes(1);
    }
  });

  it("matches case-insensitively on both sides", async () => {
    m.filters.mockResolvedValue([filter({ subject_contains: "YOUR NOTE", star: true })]);
    await applyFilters(msg({ subject: "Re: Your Note" }), ctx());
    expect(m.labels).toHaveBeenCalledTimes(1);
  });

  it("requires every condition for match_type all, and any one for match_type any", async () => {
    const conds = { from_contains: "acme.co", subject_contains: "nowhere near this" };

    m.filters.mockResolvedValue([filter({ ...conds, match_type: "all", star: true })]);
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();

    vi.clearAllMocks();
    m.filters.mockResolvedValue([filter({ ...conds, match_type: "any", star: true })]);
    await applyFilters(msg(), ctx());
    expect(m.labels).toHaveBeenCalledTimes(1);
  });

  it("treats an unknown match_type as all, not as any", async () => {
    // Failing closed on an unrecognised value keeps a corrupt row from over-matching.
    m.filters.mockResolvedValue([
      filter({ from_contains: "acme.co", subject_contains: "nope", match_type: "weird", star: true }),
    ]);
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();
  });

  it("prefers an explicit label id over creating one by name", async () => {
    m.filters.mockResolvedValue([
      filter({ subject_contains: "your note", add_label_id: "Label_9", add_label_name: "Sales" }),
    ]);
    await applyFilters(msg(), ctx());
    expect(m.getLabel).not.toHaveBeenCalled();
    expect(m.labels.mock.calls[0][2].addLabelIds).toEqual(["Label_9"]);
  });

  it("creates a label by name when no id is stored", async () => {
    m.filters.mockResolvedValue([filter({ subject_contains: "your note", add_label_name: "Sales" })]);
    await applyFilters(msg(), ctx());
    expect(m.getLabel).toHaveBeenCalledWith("tok", "Sales");
    expect(m.labels.mock.calls[0][2].addLabelIds).toEqual(["Label_1"]);
  });

  it("skips the label when it cannot be created, instead of adding a null id", async () => {
    m.getLabel.mockResolvedValue(null);
    m.filters.mockResolvedValue([filter({ subject_contains: "your note", add_label_name: "Sales" })]);
    await applyFilters(msg(), ctx());
    expect(m.labels).not.toHaveBeenCalled();
  });

  it("collapses the actions of several matching filters into one call", async () => {
    m.filters.mockResolvedValue([
      filter({ id: "a", subject_contains: "your note", star: true }),
      filter({ id: "b", from_contains: "acme.co", archive: true }),
      filter({ id: "c", subject_contains: "your note", star: true }),
    ]);
    await applyFilters(msg(), ctx());
    expect(m.labels).toHaveBeenCalledTimes(1);
    expect(m.labels.mock.calls[0][2]).toEqual({ addLabelIds: ["STARRED"], removeLabelIds: ["INBOX"] });
  });

  it("asks only for this user's enabled filters, scoped to this mailbox or to all", async () => {
    await applyFilters(msg(), ctx());
    expect(m.filters.mock.calls[0][0].where).toMatchObject({
      user_id: "u1",
      enabled: true,
      OR: [{ account_email: null }, { account_email: "me@vierradev.com" }],
    });
  });
});

/* --------------------------- */
/* maybeSendVacationReply      */
/* --------------------------- */

describe("maybeSendVacationReply", () => {
  const setting = (over: Record<string, unknown> = {}) => ({
    id: "s1",
    vacation_responder_enabled: true,
    vacation_start_at: null,
    vacation_end_at: null,
    vacation_reply_frequency_hours: 24,
    vacation_subject: "Away",
    vacation_body_text: "Back Monday.",
    vacation_body_html: "<p>Back Monday.</p>",
    ...over,
  });

  it("never replies to the mailbox itself", async () => {
    m.setting.mockResolvedValue(setting());
    await maybeSendVacationReply(msg({ fromEmail: "me@vierradev.com" }), ctx());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("does nothing without a sender address", async () => {
    m.setting.mockResolvedValue(setting());
    await maybeSendVacationReply(msg({ fromEmail: "" }), ctx());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("does nothing when there is no settings row or the responder is off", async () => {
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();

    m.setting.mockResolvedValue(setting({ vacation_responder_enabled: false }));
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("respects both ends of the vacation window", async () => {
    m.setting.mockResolvedValue(setting({ vacation_start_at: new Date("2026-06-02T00:00:00Z") }));
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();

    m.setting.mockResolvedValue(setting({ vacation_end_at: new Date("2026-05-31T00:00:00Z") }));
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();

    m.setting.mockResolvedValue(
      setting({
        vacation_start_at: new Date("2026-05-30T00:00:00Z"),
        vacation_end_at: new Date("2026-06-10T00:00:00Z"),
      })
    );
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("throttles a repeat sender inside the frequency window and releases after it", async () => {
    m.setting.mockResolvedValue(setting({ vacation_reply_frequency_hours: 24 }));

    // 23h ago: still inside the window.
    m.vacLog.mockResolvedValue({ last_sent_at: new Date(NOW.getTime() - 23 * 3600_000) });
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();

    // 25h ago: window elapsed.
    m.vacLog.mockResolvedValue({ last_sent_at: new Date(NOW.getTime() - 25 * 3600_000) });
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("falls back to a 24-hour window when the frequency is unset", async () => {
    m.setting.mockResolvedValue(setting({ vacation_reply_frequency_hours: null }));
    m.vacLog.mockResolvedValue({ last_sent_at: new Date(NOW.getTime() - 23 * 3600_000) });
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send).not.toHaveBeenCalled();
  });

  it("threads the auto-reply onto the original message", async () => {
    m.setting.mockResolvedValue(setting());
    await maybeSendVacationReply(msg(), ctx());

    const [userId, payload, baseUrl] = m.send.mock.calls[0];
    expect(userId).toBe("u1");
    expect(baseUrl).toBe("https://vierradev.com");
    expect(payload).toMatchObject({
      accountEmail: "me@vierradev.com",
      to: "sam@acme.co",
      subject: "Away",
      threadId: "t1",
      inReplyTo: "<abc@acme.co>",
      references: "<abc@acme.co>",
    });
  });

  it("uses a default subject when the configured one is blank", async () => {
    m.setting.mockResolvedValue(setting({ vacation_subject: "   " }));
    await maybeSendVacationReply(msg(), ctx());
    expect(m.send.mock.calls[0][1].subject).toBe("Automatic reply");
  });

  it("records the send only after it succeeded", async () => {
    // Logging a failed send would throttle that sender for the whole window and they would never
    // get the auto-reply at all.
    m.setting.mockResolvedValue(setting());
    m.send.mockResolvedValue({ ok: false, error: "smtp refused" });

    await maybeSendVacationReply(msg(), ctx());
    expect(m.vacUpsert).not.toHaveBeenCalled();

    m.send.mockResolvedValue({ ok: true });
    await maybeSendVacationReply(msg(), ctx());
    expect(m.vacUpsert).toHaveBeenCalledTimes(1);
    expect(m.vacUpsert.mock.calls[0][0]).toMatchObject({
      create: { email_account_setting_id: "s1", sender_email: "sam@acme.co", last_sent_at: NOW },
      update: { last_sent_at: NOW, updated_at: NOW },
    });
  });
});

/* --------------------------- */
/* maybeRecordBounce           */
/* --------------------------- */

describe("maybeRecordBounce", () => {
  it("does not fetch the body for a message that does not look like a bounce", async () => {
    // The inbound loop only pulls headers; the full fetch is the expensive part, so the cheap
    // header check has to come first.
    await maybeRecordBounce(msg(), ctx());
    expect(m.get).not.toHaveBeenCalled();
  });

  it("suppresses the contact and records the bounce for a permanent failure", async () => {
    m.get.mockResolvedValue({ ok: true, data: dsnFor("dead@acme.co", "5.1.1") });
    m.ccFirst.mockResolvedValue({ id: "cc1", campaign_id: "camp1" });

    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());

    expect(m.ccUpdate).toHaveBeenCalledWith({
      where: { id: "cc1" },
      data: { queue_status: "skipped", skip_reason: "bounce", next_send_at: null },
    });
    expect(m.stat).toHaveBeenCalledWith("camp1", "bounces");
    expect(m.dnc).toHaveBeenCalledWith("camp1", "dead@acme.co", "bounce");
  });

  it("leaves a transient failure alone, because the sender retries it", async () => {
    m.get.mockResolvedValue({ ok: true, data: dsnFor("busy@acme.co", "4.2.2") });
    m.ccFirst.mockResolvedValue({ id: "cc1", campaign_id: "camp1" });

    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());

    expect(m.ccFirst).not.toHaveBeenCalled();
    expect(m.ccUpdate).not.toHaveBeenCalled();
    expect(m.dnc).not.toHaveBeenCalled();
  });

  it("fails closed when the mailbox has no resolvable provider account", async () => {
    // Bounces come back to the sending mailbox, so only campaigns sent FROM this account may
    // match. With no account there is no reliable scope, and matching anyway would suppress a
    // contact belonging to a different tenant.
    m.get.mockResolvedValue({ ok: true, data: dsnFor("dead@acme.co", "5.1.1") });
    m.account.mockResolvedValue(null);

    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());

    expect(m.ccFirst).not.toHaveBeenCalled();
    expect(m.ccUpdate).not.toHaveBeenCalled();
  });

  it("scopes the contact lookup to this account and ignores already-stopped contacts", async () => {
    m.get.mockResolvedValue({ ok: true, data: dsnFor("dead@acme.co", "5.1.1") });
    m.ccFirst.mockResolvedValue(null);

    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());

    expect(m.ccFirst.mock.calls[0][0].where).toMatchObject({
      contact_email: "dead@acme.co",
      queue_status: { notIn: ["skipped", "failed"] },
      campaigns: { account_id: "acct1" },
    });
    expect(m.ccUpdate).not.toHaveBeenCalled();
  });

  it("gives up quietly when the full fetch fails or returns nothing usable", async () => {
    for (const response of [{ ok: false, data: null }, { ok: true, data: null }, { ok: true, data: "nope" }]) {
      vi.clearAllMocks();
      m.account.mockResolvedValue("acct1");
      m.get.mockResolvedValue(response);
      await expect(maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx())).resolves.toBeUndefined();
      expect(m.ccUpdate).not.toHaveBeenCalled();
    }
  });

  it("handles a report with no delivery-status part", async () => {
    m.get.mockResolvedValue({ ok: true, data: { payload: { mimeType: "text/plain", body: {} } } });
    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());
    expect(m.ccFirst).not.toHaveBeenCalled();
  });

  it("suppresses each permanently-failed recipient in a multi-recipient report", async () => {
    m.get.mockResolvedValue({
      ok: true,
      data: dsnPayload(
        "Reporting-MTA: dns; mx.google.com\n\n" +
          "Final-Recipient: rfc822; dead1@acme.co\nAction: failed\nStatus: 5.1.1\n\n" +
          "Final-Recipient: rfc822; slow@acme.co\nAction: delayed\nStatus: 4.4.1\n\n" +
          "Final-Recipient: rfc822; dead2@acme.co\nAction: failed\nStatus: 5.2.1\n"
      ),
    });
    m.ccFirst.mockImplementation(async ({ where }: { where: { contact_email: string } }) => ({
      id: `cc-${where.contact_email}`,
      campaign_id: "camp1",
    }));

    await maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx());

    expect(m.ccUpdate).toHaveBeenCalledTimes(2);
    expect(m.dnc.mock.calls.map((c) => c[1]).sort()).toEqual(["dead1@acme.co", "dead2@acme.co"]);
  });

  it("still suppresses the contact when adding to the DNC list fails", async () => {
    // The DNC write is the last step and is best-effort; losing it must not undo the suppression
    // or throw out of the inbound loop.
    m.get.mockResolvedValue({ ok: true, data: dsnFor("dead@acme.co", "5.1.1") });
    m.ccFirst.mockResolvedValue({ id: "cc1", campaign_id: "camp1" });
    m.dnc.mockRejectedValue(new Error("dnc table locked"));

    await expect(maybeRecordBounce(msg({ headers: BOUNCE_HEADERS }), ctx())).resolves.toBeUndefined();
    expect(m.ccUpdate).toHaveBeenCalledTimes(1);
  });

  it("recognises a bounce from the daemon address alone", async () => {
    m.get.mockResolvedValue({ ok: true, data: dsnFor("dead@acme.co", "5.1.1") });
    m.ccFirst.mockResolvedValue({ id: "cc1", campaign_id: "camp1" });

    await maybeRecordBounce(msg({ fromEmail: "mailer-daemon@googlemail.com" }), ctx());
    expect(m.get).toHaveBeenCalledTimes(1);
    expect(m.ccUpdate).toHaveBeenCalledTimes(1);
  });
});

/* --------------------------- */
/* maybeAutoDraft              */
/* --------------------------- */

describe("maybeAutoDraft", () => {
  const enable = () => {
    m.aiOn.mockReturnValue(true);
    m.aiPref.mockResolvedValue({ autonomy: "autodraft", tone: "warm and direct" });
    m.ai.mockResolvedValue({ ok: true, text: "Thursday works. I will send an invite." });
  };

  it("does nothing when Artemis is not configured", async () => {
    m.aiOn.mockReturnValue(false);
    await maybeAutoDraft(msg(), ctx());
    expect(m.aiPref).not.toHaveBeenCalled();
    expect(m.draft).not.toHaveBeenCalled();
  });

  it("does nothing unless the user opted into auto-drafting", async () => {
    m.aiOn.mockReturnValue(true);
    for (const pref of [null, { autonomy: "off" }, { autonomy: "suggest" }]) {
      vi.clearAllMocks();
      m.aiOn.mockReturnValue(true);
      m.aiPref.mockResolvedValue(pref);
      await maybeAutoDraft(msg(), ctx());
      expect(m.ai, JSON.stringify(pref)).not.toHaveBeenCalled();
    }
  });

  it("drafts a threaded reply and never sends it", async () => {
    enable();
    await maybeAutoDraft(msg(), ctx());

    expect(m.draft).toHaveBeenCalledTimes(1);
    expect(m.send).not.toHaveBeenCalled();
    const [token, payload] = m.draft.mock.calls[0];
    expect(token).toBe("tok");
    expect(payload).toMatchObject({
      to: "Sam Reed <sam@acme.co>",
      subject: "Re: your note",
      bodyText: "Thursday works. I will send an invite.",
      threadId: "t1",
      inReplyTo: "<abc@acme.co>",
      references: "<abc@acme.co>",
    });
  });

  it("does not double the Re: prefix, and supplies one when missing", async () => {
    enable();
    await maybeAutoDraft(msg({ subject: "RE: your note" }), ctx());
    expect(m.draft.mock.calls[0][1].subject).toBe("RE: your note");

    vi.clearAllMocks();
    enable();
    await maybeAutoDraft(msg({ subject: "your note" }), ctx());
    expect(m.draft.mock.calls[0][1].subject).toBe("Re: your note");

    vi.clearAllMocks();
    enable();
    await maybeAutoDraft(msg({ subject: "  " }), ctx());
    expect(m.draft.mock.calls[0][1].subject).toBe("Re: (No Subject)");
  });

  it("creates no draft when the model fails or returns only whitespace", async () => {
    for (const result of [{ ok: false, text: "" }, { ok: true, text: "" }, { ok: true, text: "   \n  " }]) {
      vi.clearAllMocks();
      enable();
      m.ai.mockResolvedValue(result);
      await maybeAutoDraft(msg(), ctx());
      expect(m.draft, JSON.stringify(result)).not.toHaveBeenCalled();
    }
  });

  it("puts the reply body in the prompt as quoted data, and asks for a draft", async () => {
    // The reply is untrusted text. What is pinned here is that it is passed as the user turn's
    // content and the instruction stays in the system turn — not that any particular wording is
    // used, which would make this a test of the prompt's prose.
    enable();
    await maybeAutoDraft(msg(), ctx());
    const [{ system, messages, maxTokens }] = m.ai.mock.calls[0];

    expect(system).toContain("warm and direct");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("Sounds good, let us talk Thursday.");
    expect(system).not.toContain("Sounds good, let us talk Thursday.");
    expect(maxTokens).toBe(800);
  });

  it("grounds the draft in prior threads and the stored contact when they exist", async () => {
    enable();
    m.contact.mockResolvedValue({ first_name: "Sam", last_name: "Reed", business: "Acme" });
    m.outMany.mockResolvedValue([{ subject: "Intro", body_text: "Nice to meet you." }]);

    await maybeAutoDraft(msg(), ctx());
    const { system } = m.ai.mock.calls[0][0];
    expect(system).toContain("Sam Reed");
    expect(system).toContain("Acme");
    expect(system).toContain("Intro");
  });

  it("falls back to a default tone when none is stored", async () => {
    m.aiOn.mockReturnValue(true);
    m.aiPref.mockResolvedValue({ autonomy: "autodraft", tone: null });
    m.ai.mockResolvedValue({ ok: true, text: "ok" });
    await maybeAutoDraft(msg(), ctx());
    expect(m.ai.mock.calls[0][0].system).toContain("professional and friendly");
  });
});

/* --------------------------- */
/* maybeHandleMdn              */
/* --------------------------- */

describe("maybeHandleMdn", () => {
  const MDN = { "content-type": "multipart/report; report-type=disposition-notification" };

  it("records a READ event against the most recent message sent to that address", async () => {
    m.outFirst.mockResolvedValue({ id: "out1" });
    await maybeHandleMdn(msg({ headers: MDN }), ctx());

    expect(m.trackCreate).toHaveBeenCalledWith({
      data: {
        outbound_message_id: "out1",
        event_type: "READ",
        recipient_email: "sam@acme.co",
        occurred_at: NOW,
      },
    });
  });

  it("also accepts a multipart/report whose subject starts with Read:", async () => {
    m.outFirst.mockResolvedValue({ id: "out1" });
    await maybeHandleMdn(msg({ headers: { "content-type": "multipart/report" }, subject: "Read: your note" }), ctx());
    expect(m.trackCreate).toHaveBeenCalledTimes(1);
  });

  it("ignores a multipart/report that is not a read receipt", async () => {
    // A bounce is also multipart/report; treating it as a read would report opens that never
    // happened, on an address that does not even exist any more.
    await maybeHandleMdn(msg({ headers: { "content-type": "multipart/report" }, subject: "Undelivered Mail" }), ctx());
    expect(m.outFirst).not.toHaveBeenCalled();
    expect(m.trackCreate).not.toHaveBeenCalled();
  });

  it("ignores an ordinary message", async () => {
    await maybeHandleMdn(msg({ headers: { "content-type": "text/html" } }), ctx());
    expect(m.outFirst).not.toHaveBeenCalled();

    await maybeHandleMdn(msg(), ctx());
    expect(m.outFirst).not.toHaveBeenCalled();
  });

  it("records nothing when no tracked message went to that address", async () => {
    m.outFirst.mockResolvedValue(null);
    await maybeHandleMdn(msg({ headers: MDN }), ctx());
    expect(m.trackCreate).not.toHaveBeenCalled();
  });

  it("scopes the lookup to this user", async () => {
    m.outFirst.mockResolvedValue({ id: "out1" });
    await maybeHandleMdn(msg({ headers: MDN }), ctx());
    expect(m.outFirst.mock.calls[0][0].where).toMatchObject({
      user_id: "u1",
      email_outbound_recipients: { some: { email: "sam@acme.co" } },
    });
  });
});

/* --------------------------- */
/* maybeReplyIntelligence      */
/* --------------------------- */

describe("maybeReplyIntelligence", () => {
  const contact = (over: Record<string, unknown> = {}) => ({
    id: "cc1",
    campaign_id: "camp1",
    lead_status: "no_response",
    queue_status: "sent",
    ...over,
  });

  it("fails closed when the mailbox has no resolvable provider account", async () => {
    // The regression this guards: without a scope filter, a prospect address shared by two
    // tenants' campaigns matched the most-recently-enrolled contact ACROSS EVERY TENANT, and
    // flipped the wrong company's lead status.
    m.account.mockResolvedValue(null);

    expect(await maybeReplyIntelligence(msg())).toBeNull();
    expect(m.ccFirst).not.toHaveBeenCalled();
    expect(m.ccUpdate).not.toHaveBeenCalled();
  });

  it("scopes the match to campaigns sent from this account", async () => {
    await maybeReplyIntelligence(msg());
    expect(m.ccFirst.mock.calls[0][0].where).toMatchObject({
      contact_email: "sam@acme.co",
      campaigns: { account_id: "acct1" },
    });
  });

  it("still matches a contact whose sequence has completed", async () => {
    // Excluding "completed" is what made most real replies match nothing: sendQueueTick marks a
    // contact completed as soon as the last step goes out, which is exactly when replies arrive.
    await maybeReplyIntelligence(msg());
    const excluded = m.ccFirst.mock.calls[0][0].where.queue_status.notIn;
    expect(excluded).toEqual(["paused", "skipped", "failed"]);
    expect(excluded).not.toContain("completed");
    expect(excluded).not.toContain("sent");
  });

  it("returns null when no campaign contact matches", async () => {
    expect(await maybeReplyIntelligence(msg())).toBeNull();
    expect(m.ccUpdate).not.toHaveBeenCalled();
  });

  it("pauses the sequence and records the change for an unclassified reply", async () => {
    m.ccFirst.mockResolvedValue(contact());
    const out = await maybeReplyIntelligence(msg());

    expect(out).toMatchObject({
      campaignId: "camp1",
      campaignContactId: "cc1",
      fromStatus: "no_response",
      leadStatus: "reply",
    });
    expect(m.ccUpdate.mock.calls[0][0].data).toMatchObject({ queue_status: "paused", lead_status: "reply" });
    expect(m.eventCreate.mock.calls[0][0].data).toMatchObject({
      campaign_contact_id: "cc1",
      from_status: "no_response",
      to_status: "reply",
      changed_by_rule: "inbound_reply",
    });
  });

  it("does not call the classifier when Artemis is off", async () => {
    m.ccFirst.mockResolvedValue(contact());
    await maybeReplyIntelligence(msg());
    expect(m.ai).not.toHaveBeenCalled();
  });

  it("applies the classifier's label as a canonical status", async () => {
    const cases: [string, string][] = [
      ["interested", "positive_response"],
      ["not_interested", "not_interested"],
      ["unsubscribe", "remove_contact"],
      ["neutral", "reply"],
    ];
    for (const [label, status] of cases) {
      vi.clearAllMocks();
      m.account.mockResolvedValue("acct1");
      m.aiOn.mockReturnValue(true);
      m.ai.mockResolvedValue({ ok: true, text: label });
      m.ccFirst.mockResolvedValue(contact());
      m.dnc.mockResolvedValue(undefined);

      const out = await maybeReplyIntelligence(msg());
      expect(out?.leadStatus, label).toBe(status);
    }
  });

  it("tolerates a chatty label and falls back when the classifier fails", async () => {
    m.aiOn.mockReturnValue(true);
    m.ccFirst.mockResolvedValue(contact());

    m.ai.mockResolvedValue({ ok: true, text: ' "Interested." ' });
    expect((await maybeReplyIntelligence(msg()))?.leadStatus).toBe("positive_response");

    m.ai.mockResolvedValue({ ok: false, text: "" });
    expect((await maybeReplyIntelligence(msg()))?.leadStatus).toBe("reply");

    m.ai.mockResolvedValue({ ok: true, text: "probably keen?" });
    expect((await maybeReplyIntelligence(msg()))?.leadStatus).toBe("reply");
  });

  it("does not downgrade a status that already carries signal", async () => {
    // isAutomatedSender only reads headers, so a human reply that merely reads like an
    // out-of-office note reaches here and classifies as no_response.
    m.aiOn.mockReturnValue(true);
    m.ai.mockResolvedValue({ ok: true, text: "out_of_office" });

    for (const sticky of ["positive_response", "meeting_booked", "not_interested", "remove_contact"]) {
      vi.clearAllMocks();
      m.account.mockResolvedValue("acct1");
      m.aiOn.mockReturnValue(true);
      m.ai.mockResolvedValue({ ok: true, text: "out_of_office" });
      m.dnc.mockResolvedValue(undefined);
      m.ccFirst.mockResolvedValue(contact({ lead_status: sticky, queue_status: "sent" }));

      const out = await maybeReplyIntelligence(msg());
      expect(out?.leadStatus, sticky).toBe(sticky);
    }
  });

  it("leaves the queue alone for an out-of-office, rather than pausing the sequence", async () => {
    // An OOO is not a reason to stop sending; pausing on one would stall the sequence until
    // someone noticed and resumed it by hand.
    m.aiOn.mockReturnValue(true);
    m.ai.mockResolvedValue({ ok: true, text: "out_of_office" });
    m.ccFirst.mockResolvedValue(contact({ lead_status: "no_response", queue_status: "sent" }));

    const out = await maybeReplyIntelligence(msg());
    expect(out?.leadStatus).toBe("no_response");
    expect(m.ccUpdate.mock.calls[0][0].data.queue_status).toBe("sent");
  });

  it("adds an auto-classified unsubscribe to the DNC list, not just the status", async () => {
    // Previously this branch changed lead_status but never suppressed the address, so the rest of
    // the sequence kept going to someone who had asked to stop.
    m.aiOn.mockReturnValue(true);
    m.ai.mockResolvedValue({ ok: true, text: "unsubscribe" });
    m.ccFirst.mockResolvedValue(contact());

    await maybeReplyIntelligence(msg());
    expect(m.dnc).toHaveBeenCalledWith("camp1", "sam@acme.co", "categorization");
  });

  it("does not touch the DNC list for any other classification", async () => {
    m.aiOn.mockReturnValue(true);
    m.ai.mockResolvedValue({ ok: true, text: "interested" });
    m.ccFirst.mockResolvedValue(contact());

    await maybeReplyIntelligence(msg());
    expect(m.dnc).not.toHaveBeenCalled();
  });

  it("sends the reply to the classifier as content, with a tight token budget", async () => {
    m.aiOn.mockReturnValue(true);
    m.ai.mockResolvedValue({ ok: true, text: "neutral" });
    m.ccFirst.mockResolvedValue(contact());

    await maybeReplyIntelligence(msg());
    const [{ messages, maxTokens }] = m.ai.mock.calls[0];
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("Sounds good, let us talk Thursday.");
    expect(maxTokens).toBe(8);
  });
});

/* --------------------------- */
/* maybeNotifyDiscord          */
/* --------------------------- */

describe("maybeNotifyDiscord", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vierradev.com");
  });

  it("does nothing when Discord is not configured", async () => {
    m.discordOn.mockReturnValue(false);
    await maybeNotifyDiscord(msg());
    expect(m.setting).not.toHaveBeenCalled();
    expect(m.embed).not.toHaveBeenCalled();
  });

  it("only pings for an actual reply to one of our threads", async () => {
    await maybeNotifyDiscord(msg({ inReplyTo: "" }));
    expect(m.embed).not.toHaveBeenCalled();
  });

  it("respects the per-inbox opt-out, and defaults to on with no settings row", async () => {
    m.setting.mockResolvedValue({ reply_notifications_enabled: false });
    await maybeNotifyDiscord(msg());
    expect(m.embed).not.toHaveBeenCalled();

    vi.clearAllMocks();
    m.discordOn.mockReturnValue(true);
    m.setting.mockResolvedValue(null);
    await maybeNotifyDiscord(msg());
    expect(m.embed).toHaveBeenCalledTimes(1);
  });

  it("deep-links into the panel at this mailbox and thread", async () => {
    await maybeNotifyDiscord(msg());
    expect(m.embed.mock.calls[0][0].url).toBe(
      "https://vierradev.com/panel/email?accounts=me%40vierradev.com&thread=t1"
    );
  });

  it("strips a trailing slash from the configured base URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vierradev.com/");
    await maybeNotifyDiscord(msg());
    expect(m.embed.mock.calls[0][0].url).toContain("https://vierradev.com/panel/email?");
  });

  it("omits the link entirely when no base URL is configured", async () => {
    // A relative or empty href would make Discord reject the embed.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    await maybeNotifyDiscord(msg());
    expect(m.embed.mock.calls[0][0]).not.toHaveProperty("url");
  });

  it("falls back to APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("APP_URL", "https://staging.vierradev.com");
    await maybeNotifyDiscord(msg());
    expect(m.embed.mock.calls[0][0].url).toContain("https://staging.vierradev.com/panel/email");
  });

  it("sends the enriched campaign ping when the reply matched a contact", async () => {
    m.campaign.mockResolvedValue({ name: "Q1 outreach" });
    await maybeNotifyDiscord(msg(), {
      campaignId: "camp1",
      campaignContactId: "cc1",
      fromStatus: "no_response",
      leadStatus: "positive_response",
    });

    expect(m.embed).not.toHaveBeenCalled();
    expect(m.campaignPing).toHaveBeenCalledTimes(1);
    expect(m.campaignPing.mock.calls[0][0]).toMatchObject({
      contactEmail: "sam@acme.co",
      campaignName: "Q1 outreach",
      leadStatus: "positive_response",
      fromStatus: "no_response",
      subject: "Re: your note",
    });
  });

  it("still pings when the campaign row has gone missing", async () => {
    m.campaign.mockResolvedValue(null);
    await maybeNotifyDiscord(msg(), {
      campaignId: "camp1",
      campaignContactId: "cc1",
      fromStatus: null,
      leadStatus: "reply",
    });
    expect(m.campaignPing.mock.calls[0][0].campaignName).toBe("(unknown)");
  });

  it("truncates the fields Discord limits, so the embed is not rejected", async () => {
    await maybeNotifyDiscord(
      msg({ from: "F".repeat(400), subject: "S".repeat(400), snippet: "N".repeat(900) })
    );
    const embed = m.embed.mock.calls[0][0];
    expect(embed.author.name.length).toBeLessThanOrEqual(256);
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(embed.description.length).toBeLessThanOrEqual(500);
  });

  it("labels a subjectless message rather than sending an empty title", async () => {
    await maybeNotifyDiscord(msg({ subject: "", snippet: "" }));
    const embed = m.embed.mock.calls[0][0];
    expect(embed.title).toBe("(no subject)");
    expect(embed.description).toBeUndefined();
    expect(embed.fields).toEqual([{ name: "Inbox", value: "me@vierradev.com", inline: true }]);
  });

  it("names the sender from the raw header, falling back to the address", async () => {
    await maybeNotifyDiscord(msg());
    expect(m.embed.mock.calls[0][0].author.name).toBe("Reply From Sam Reed <sam@acme.co>");

    vi.clearAllMocks();
    m.discordOn.mockReturnValue(true);
    m.setting.mockResolvedValue(null);
    await maybeNotifyDiscord(msg({ from: "" }));
    expect(m.embed.mock.calls[0][0].author.name).toBe("Reply From sam@acme.co");
  });
});
