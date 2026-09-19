/**
 * When an invoice is due.
 *
 * The contract renews on a particular day of the month, so every invoice under it falls due on
 * that same day — but Stripe only carries a due_date when an invoice was raised with
 * `send_invoice` collection, and a subscription invoice charged automatically has none at all.
 * The column read "On receipt" for those, which is not what the contract says.
 *
 * So the renewal day drives the column whenever there is a subscription, and Stripe's own due date
 * is the fallback for a one-off invoice raised outside one.
 *
 * All of the arithmetic is in local time, deliberately. The panel renders every date with
 * toLocaleDateString, so a due date built at UTC midnight came out a day early everywhere west of
 * Greenwich — a contract renewing on the 6th showed invoices due on the 5th, in a column whose
 * whole point is to match the renewal day. Reading the renewal's local day and building a local
 * date keeps the two agreeing however the reader's clock is set.
 */

/** Days in the given month, so the 31st does not roll into the next month in February. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * `renewalIso` is the subscription's current period end; only its day-of-month is used, since the
 * period end itself is one specific future date and every past invoice needs its own.
 *
 * Returns an ISO string, or null when there is nothing to derive it from.
 */
export function invoiceDueDate(params: {
  createdIso: string;
  stripeDueIso: string | null;
  renewalIso: string | null;
}): string | null {
  const { createdIso, stripeDueIso, renewalIso } = params;

  if (!renewalIso) return stripeDueIso;

  const renewal = new Date(renewalIso);
  const created = new Date(createdIso);
  if (Number.isNaN(renewal.getTime()) || Number.isNaN(created.getTime())) return stripeDueIso;

  const renewalDay = renewal.getDate();
  let year = created.getFullYear();
  let month = created.getMonth();

  // An invoice raised on the 20th for a contract that renews on the 5th is due on the 5th of the
  // following month, not on a day that has already passed.
  if (renewalDay < created.getDate()) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const day = Math.min(renewalDay, daysInMonth(year, month));
  // Midday, not midnight: a date-only value built at 00:00 local is one DST shift away from
  // landing on the previous day when it is read back.
  return new Date(year, month, day, 12).toISOString();
}
