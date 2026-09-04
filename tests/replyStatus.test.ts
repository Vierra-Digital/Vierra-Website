import { describe, expect, it } from "vitest";
import { LEAD_STATUSES } from "@/lib/api/campaigns";
import {
  DEFAULT_REPLY_LEAD_STATUS,
  isLeadStatus,
  leadStatusFromReplyLabel,
  normalizeReplyLabel,
  REPLY_LABEL_TO_LEAD_STATUS,
  resolveReplyLeadStatus,
  STICKY_LEAD_STATUSES,
} from "@/lib/campaigns/replyStatus";

/**
 * This logic decides what an inbound reply does to a campaign contact's lead status, and it has
 * been wrong before in a way nothing caught: the map was typed Record<string, string> and shipped
 * writing "interested" and "unsubscribed", neither of which is in LEAD_STATUSES. The rows were
 * written, nothing raised, and those replies simply never matched the panel's status filters.
 *
 * The first block is the guard against that recurring: every value the map can produce, and every
 * member of the sticky set, has to be a canonical status. TypeScript enforces it now too, but the
 * cost of a status that exists nowhere else is a silent wrong answer, so it is worth both.
 */

describe("every status this module can produce is canonical", () => {
  it("maps only to LEAD_STATUSES", () => {
    for (const [label, status] of Object.entries(REPLY_LABEL_TO_LEAD_STATUS)) {
      expect(isLeadStatus(status), `${label} -> ${status}`).toBe(true);
    }
  });

  it("only marks canonical statuses as sticky", () => {
    for (const status of STICKY_LEAD_STATUSES) {
      expect(isLeadStatus(status), status).toBe(true);
    }
  });

  it("defaults to a canonical status", () => {
    expect(isLeadStatus(DEFAULT_REPLY_LEAD_STATUS)).toBe(true);
  });

  it("rejects the two values that actually shipped wrong", () => {
    // Named explicitly: these were written to the database and matched no filter.
    expect(isLeadStatus("interested")).toBe(false);
    expect(isLeadStatus("unsubscribed")).toBe(false);
    // Their correct counterparts.
    expect(isLeadStatus("positive_response")).toBe(true);
    expect(isLeadStatus("remove_contact")).toBe(true);
  });

  it("covers every label the classifier prompt asks for", () => {
    // The prompt names five labels; a label with no mapping falls back silently, so a prompt
    // change without a map change would quietly stop classifying.
    for (const label of ["interested", "not_interested", "out_of_office", "unsubscribe", "neutral"]) {
      expect(leadStatusFromReplyLabel(label), label).not.toBeNull();
    }
  });
});

describe("normalizeReplyLabel", () => {
  it("strips what a model adds around a bare label", () => {
    for (const raw of ["interested", " interested ", "Interested", "INTERESTED", '"interested"', "interested.", "`interested`"]) {
      expect(normalizeReplyLabel(raw), JSON.stringify(raw)).toBe("interested");
    }
  });

  it("keeps the underscore, since four of the five labels contain one", () => {
    expect(normalizeReplyLabel("not_interested")).toBe("not_interested");
    expect(normalizeReplyLabel("OUT_OF_OFFICE")).toBe("out_of_office");
  });

  it("does not turn a sentence into a label by accident", () => {
    // A chatty model answering "The reply is interested." must not normalise to "interested".
    expect(normalizeReplyLabel("The reply is interested.")).not.toBe("interested");
  });
});

describe("leadStatusFromReplyLabel", () => {
  it("returns the canonical status for each known label", () => {
    expect(leadStatusFromReplyLabel("interested")).toBe("positive_response");
    expect(leadStatusFromReplyLabel("not_interested")).toBe("not_interested");
    expect(leadStatusFromReplyLabel("out_of_office")).toBe("no_response");
    expect(leadStatusFromReplyLabel("unsubscribe")).toBe("remove_contact");
    expect(leadStatusFromReplyLabel("neutral")).toBe("reply");
  });

  it("returns null rather than guessing at an unknown label", () => {
    for (const raw of ["", "maybe", "positive", "unsubscribed", "interested_maybe", "42"]) {
      expect(leadStatusFromReplyLabel(raw), raw).toBeNull();
    }
  });
});

describe("resolveReplyLeadStatus", () => {
  it("falls back to a reply when there is no classification at all", () => {
    // A reply still pauses the sequence, so it needs a status even with the classifier off.
    for (const label of [null, undefined, "", "nonsense"]) {
      expect(resolveReplyLeadStatus(label, "no_response"), String(label)).toBe("reply");
    }
  });

  it("applies the classification when there is one", () => {
    expect(resolveReplyLeadStatus("interested", "no_response")).toBe("positive_response");
    expect(resolveReplyLeadStatus("unsubscribe", "no_response")).toBe("remove_contact");
  });

  it("will not downgrade a status that already carries signal", () => {
    // The out-of-office case: a human reply that merely reads like an OOO note classifies as
    // no_response, and must not erase what is already known about the lead.
    for (const sticky of STICKY_LEAD_STATUSES) {
      expect(resolveReplyLeadStatus("out_of_office", sticky), sticky).toBe(sticky);
    }
  });

  it("does apply no_response over a status that carries no signal", () => {
    for (const weak of ["no_response", "reply", "follow_up"]) {
      expect(resolveReplyLeadStatus("out_of_office", weak), weak).toBe("no_response");
    }
  });

  it("only protects against no_response, not against a real classification", () => {
    // An explicit unsubscribe must win even over meeting_booked — the contact asked to stop.
    expect(resolveReplyLeadStatus("unsubscribe", "meeting_booked")).toBe("remove_contact");
    expect(resolveReplyLeadStatus("not_interested", "positive_response")).toBe("not_interested");
  });

  it("handles a missing current status without throwing", () => {
    for (const current of [null, undefined, ""]) {
      expect(resolveReplyLeadStatus("out_of_office", current), String(current)).toBe("no_response");
    }
  });

  it("never returns a status outside LEAD_STATUSES, whatever it is given", () => {
    const labels = [null, undefined, "", "interested", "junk", "OUT_OF_OFFICE ", "unsubscribe"];
    const currents = [null, "", "no_response", "meeting_booked", "not_a_status", "positive_response"];
    for (const l of labels) {
      for (const c of currents) {
        const out = resolveReplyLeadStatus(l, c);
        expect(
          (LEAD_STATUSES as readonly string[]).includes(out),
          `label=${String(l)} current=${String(c)} -> ${out}`
        ).toBe(true);
      }
    }
  });
});
