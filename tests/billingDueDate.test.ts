import { describe, expect, it } from "vitest";
import { invoiceDueDate } from "@/lib/billing/dueDate";

/**
 * Invoices under a contract fall due on the day the contract renews. Stripe only carries a
 * due_date for invoices raised with `send_invoice` collection, so a subscription charged
 * automatically had none and the column read "On receipt" — which is not what the contract says.
 */

/**
 * The value is built in local time and rendered with toLocaleDateString, so the assertions read
 * the local calendar day. Slicing the ISO string would test UTC and pass or fail with the runner's
 * time zone — which is exactly the bug this helper had.
 */
const day = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("with a subscription", () => {
  const renewal = "2026-10-06T12:00:00.000Z"; // renews on the 6th

  it("falls on the renewal day of the invoice's own month", () => {
    expect(day(invoiceDueDate({ createdIso: "2026-09-02T12:00:00Z", stripeDueIso: null, renewalIso: renewal })))
      .toBe("2026-09-06");
  });

  it("rolls to next month when the renewal day has already passed", () => {
    // An invoice raised on the 20th is not due on the 6th of the same month.
    expect(day(invoiceDueDate({ createdIso: "2026-09-20T12:00:00Z", stripeDueIso: null, renewalIso: renewal })))
      .toBe("2026-10-06");
  });

  it("is the same day when the invoice is raised on the renewal day", () => {
    expect(day(invoiceDueDate({ createdIso: "2026-09-06T12:00:00Z", stripeDueIso: null, renewalIso: renewal })))
      .toBe("2026-09-06");
  });

  it("rolls the year over from December", () => {
    expect(day(invoiceDueDate({ createdIso: "2026-12-20T12:00:00Z", stripeDueIso: null, renewalIso: renewal })))
      .toBe("2027-01-06");
  });

  it("clamps a 31st renewal to the last day of a shorter month", () => {
    // Otherwise the 31st of February silently becomes the 3rd of March.
    const r = "2026-01-31T12:00:00.000Z";
    expect(day(invoiceDueDate({ createdIso: "2026-02-01T12:00:00Z", stripeDueIso: null, renewalIso: r })))
      .toBe("2026-02-28");
    expect(day(invoiceDueDate({ createdIso: "2026-04-01T12:00:00Z", stripeDueIso: null, renewalIso: r })))
      .toBe("2026-04-30");
  });

  it("clamps a 29th renewal in a non-leap February", () => {
    const r = "2026-03-29T12:00:00.000Z";
    expect(day(invoiceDueDate({ createdIso: "2026-02-01T12:00:00Z", stripeDueIso: null, renewalIso: r })))
      .toBe("2026-02-28");
  });

  it("overrides a Stripe due date that disagrees with the contract", () => {
    // The contract is what the client agreed to; Stripe's default is net-30 from creation.
    expect(day(invoiceDueDate({
      createdIso: "2026-09-02T12:00:00Z",
      stripeDueIso: "2026-10-02T12:00:00Z",
      renewalIso: renewal,
    }))).toBe("2026-09-06");
  });
});

describe("without a subscription", () => {
  it("keeps Stripe's own due date for a one-off invoice", () => {
    expect(day(invoiceDueDate({
      createdIso: "2026-09-02T12:00:00Z",
      stripeDueIso: "2026-09-16T12:00:00Z",
      renewalIso: null,
    }))).toBe("2026-09-16");
  });

  it("returns null when there is nothing to derive one from", () => {
    expect(invoiceDueDate({ createdIso: "2026-09-02T12:00:00Z", stripeDueIso: null, renewalIso: null }))
      .toBeNull();
  });
});

describe("bad input", () => {
  it("falls back to Stripe's date rather than inventing one", () => {
    expect(day(invoiceDueDate({
      createdIso: "not-a-date",
      stripeDueIso: "2026-09-16T12:00:00Z",
      renewalIso: "2026-10-06T12:00:00Z",
    }))).toBe("2026-09-16");

    expect(day(invoiceDueDate({
      createdIso: "2026-09-02T12:00:00Z",
      stripeDueIso: "2026-09-16T12:00:00Z",
      renewalIso: "nonsense",
    }))).toBe("2026-09-16");
  });
});
