import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * The Finances page: the whole business, not one client.
 *
 * Revenue comes from `stripe_invoices` (synced by the Stripe webhook's invoice.paid/
 * invoice.payment_failed handlers — see pages/api/stripe/webhook.ts), not `finance_entries`.
 * finance_entries' `kind: "revenue"` was meant to hold this, but nothing ever wrote one — every
 * revenue figure across the app read a permanently-empty column. `finance_entries` now holds only
 * expenses; the dashboard's Revenue tile and the client overview's `billedCents` read
 * `stripe_invoices` the same way this page does, so all three agree by construction.
 *
 * Admin only. Staff run campaigns for clients; company-wide takings are not part of that job, and
 * the panel hides the page from them as well as this route refusing it.
 */

type Month = {
  /** 1-12. */
  month: number;
  revenueCents: number;
  expenseCents: number;
  profitCents: number;
};

/** Same rule as the dashboard: no prior baseline reports 100%, not a division by one. */
function growthPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await requireRole(req, res, ["admin"]);
  if (!session) return;

  const now = new Date();
  const rawYear = Number(req.query.year);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : now.getUTCFullYear();

  try {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    /**
     * One query per source for the year, bucketed here.
     *
     * Twelve aggregates per kind would be many round trips for a page that is read often; a
     * year's worth of rows is small enough to bucket in memory.
     */
    const [entries, paidInvoices] = await Promise.all([
      prisma.financeEntry.findMany({
        where: { occurred_at: { gte: yearStart, lt: yearEnd }, kind: "expense" },
        select: { kind: true, amount_cents: true, occurred_at: true, note: true, company_id: true, id: true },
        orderBy: { occurred_at: "desc" },
      }),
      prisma.stripeInvoice.findMany({
        where: { status: "paid", created_at: { gte: yearStart, lt: yearEnd } },
        select: { id: true, client_id: true, amount_paid_cents: true, created_at: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    const months: Month[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenueCents: 0,
      expenseCents: 0,
      profitCents: 0,
    }));
    for (const invoice of paidInvoices) {
      months[invoice.created_at.getUTCMonth()].revenueCents += invoice.amount_paid_cents;
    }
    for (const entry of entries) {
      months[entry.occurred_at.getUTCMonth()].expenseCents += entry.amount_cents;
    }
    for (const bucket of months) bucket.profitCents = bucket.revenueCents - bucket.expenseCents;

    const yearRevenue = months.reduce((sum, m) => sum + m.revenueCents, 0);
    const yearExpense = months.reduce((sum, m) => sum + m.expenseCents, 0);

    /**
     * The current and previous month, matched to the dashboard.
     *
     * Only meaningful while looking at the current year; for a past year there is no "this month"
     * to compare, so the comparison is reported as null rather than as a misleading zero.
     */
    const isCurrentYear = year === now.getUTCFullYear();
    const thisMonthIndex = now.getUTCMonth();
    const current = isCurrentYear ? months[thisMonthIndex] : null;
    const previous = isCurrentYear && thisMonthIndex > 0 ? months[thisMonthIndex - 1] : null;

    /**
     * What is contracted, as distinct from what has been taken.
     *
     * monthly_retainer_cents is the agreed retainer on the client's billing row. Summing the
     * active ones gives committed monthly revenue, which is the number a month's takings should be
     * read against — and it comes from our own table, not from Stripe, so the page does not depend
     * on a Stripe round trip to render.
     */
    // The `clients` query below is filtered to is_active: true, so a churned client's past
    // invoices would otherwise show no name in the ledger at all — invoiceClients is looked up
    // directly by the invoices' own client_ids instead. Independent of `clients`, so run together.
    const invoiceClientIds = [...new Set(paidInvoices.map((inv) => inv.client_id).filter((id): id is string => Boolean(id)))];
    const [clients, invoiceClients] = await Promise.all([
      prisma.client.findMany({
        where: { is_active: true },
        select: {
          id: true,
          name: true,
          business_name: true,
          client_billing: {
            select: { monthly_retainer_cents: true, stripe_subscription_status: true, stripe_connected: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      invoiceClientIds.length
        ? prisma.client.findMany({
            where: { id: { in: invoiceClientIds } },
            select: { id: true, name: true, business_name: true },
          })
        : Promise.resolve([]),
    ]);
    const invoiceClientName = new Map(invoiceClients.map((c) => [c.id, c.business_name || c.name]));

    const contracted = clients
      .map((c) => ({
        id: c.id,
        name: c.business_name || c.name,
        retainerCents: c.client_billing?.monthly_retainer_cents ?? 0,
        subscriptionStatus: c.client_billing?.stripe_subscription_status ?? null,
        connected: c.client_billing?.stripe_connected ?? false,
      }))
      .sort((a, b) => b.retainerCents - a.retainerCents);

    const mrrCents = contracted.reduce((sum, c) => sum + c.retainerCents, 0);

    /**
     * What Stripe collected, read from the synced ledger rather than a live Stripe call.
     *
     * Same number as `months[].revenueCents` above — `collected` is kept as its own field so the
     * panel UI's existing "Collected" tile needs no change, but there is no longer a second,
     * independently-pulled figure that could disagree with the month breakdown.
     */
    const collected = { totalCents: yearRevenue, byMonth: months.map((m) => m.revenueCents) };

    /**
     * The ledger merges both sources — expenses (finance_entries) and revenue (paid Stripe
     * invoices) — into one chronological list. It used to be expenses only, which read as if the
     * business only ever spent money; FinancesSection.tsx's table already renders a kind:
     * "revenue" row correctly (positive-toned badge, no minus sign), nothing had ever sent it one.
     */
    const ledgerEntries = [
      ...entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amount_cents,
        occurredAt: e.occurred_at,
        note: e.note,
      })),
      ...paidInvoices.map((inv) => ({
        id: inv.id,
        kind: "revenue" as const,
        amountCents: inv.amount_paid_cents,
        // created_at, not paid_at: the month chart above buckets by created_at (and the query
        // itself filters the year on it), so the ledger uses the same field an invoice is dated
        // by everywhere else on this page — an invoice created in one month/year but paid in the
        // next would otherwise be attributed to different periods by the chart and the ledger.
        occurredAt: inv.created_at,
        note: inv.client_id ? invoiceClientName.get(inv.client_id) ?? null : null,
      })),
    ]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 100);

    return res.status(200).json({
      year,
      collected,
      months,
      totals: {
        revenueCents: yearRevenue,
        expenseCents: yearExpense,
        profitCents: yearRevenue - yearExpense,
      },
      currentMonth: current
        ? {
            month: current.month,
            revenueCents: current.revenueCents,
            expenseCents: current.expenseCents,
            profitCents: current.profitCents,
            revenueGrowth: previous ? growthPercent(current.revenueCents, previous.revenueCents) : null,
            profitGrowth: previous ? growthPercent(current.profitCents, previous.profitCents) : null,
          }
        : null,
      mrrCents,
      activeClients: contracted.filter((c) => c.retainerCents > 0).length,
      contracted,
      // Newest first, capped so one long year cannot make the page enormous.
      entries: ledgerEntries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amountCents,
        occurredAt: e.occurredAt.toISOString(),
        note: e.note,
      })),
    });
  } catch (e) {
    console.error("finances/overview", e);
    return res.status(500).json({ message: "Could not load finances." });
  }
}
