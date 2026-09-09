import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * The Finances page: the whole business, not one client.
 *
 * Reads the same `finance_entries` table the dashboard's Revenue, Expenses and Profit tiles read,
 * with the same month windows and the same growth arithmetic, so the two agree by construction
 * rather than by coincidence. The dashboard shows the current month for one company; this shows
 * every month of a year across all of them, plus what is contracted.
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
     * One query for the year, bucketed here.
     *
     * Twelve aggregates per kind would be twenty-four round trips for a page that is read often;
     * a year of entries is small enough to bucket in memory.
     */
    const entries = await prisma.financeEntry.findMany({
      where: { occurred_at: { gte: yearStart, lt: yearEnd } },
      select: { kind: true, amount_cents: true, occurred_at: true, note: true, company_id: true, id: true },
      orderBy: { occurred_at: "desc" },
    });

    const months: Month[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      revenueCents: 0,
      expenseCents: 0,
      profitCents: 0,
    }));
    for (const entry of entries) {
      const bucket = months[entry.occurred_at.getUTCMonth()];
      if (entry.kind === "revenue") bucket.revenueCents += entry.amount_cents;
      else if (entry.kind === "expense") bucket.expenseCents += entry.amount_cents;
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
    const clients = await prisma.client.findMany({
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
    });

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
     * What Stripe actually collected, alongside what the ledger records.
     *
     * These are two different questions and the page shows both. finance_entries is the book the
     * dashboard reads, kept by hand; Stripe is money that genuinely moved. Right now the ledger is
     * empty while Stripe holds paid invoices, so a page showing only the ledger would be a grid of
     * zeros next to a business that has taken payments.
     *
     * Best-effort: Stripe being unreachable leaves this null and the rest of the page stands.
     */
    let collected: { totalCents: number; byMonth: number[] } | null = null;
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const { stripe } = await import("@/lib/stripe");
        const paid = await stripe.invoices
          .list({
            status: "paid",
            created: { gte: Math.floor(yearStart.getTime() / 1000), lt: Math.floor(yearEnd.getTime() / 1000) },
            limit: 100,
          })
          .autoPagingToArray({ limit: 1000 });
        const byMonth = Array(12).fill(0);
        for (const invoice of paid) {
          byMonth[new Date(invoice.created * 1000).getUTCMonth()] += invoice.amount_paid;
        }
        collected = { totalCents: byMonth.reduce((a, b) => a + b, 0), byMonth };
      } catch (stripeError) {
        console.warn("finances/overview: Stripe unavailable, ledger only:", stripeError);
      }
    }

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
      // The ledger, newest first, capped so one long year cannot make the page enormous.
      entries: entries.slice(0, 100).map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amount_cents,
        occurredAt: e.occurred_at.toISOString(),
        note: e.note,
      })),
    });
  } catch (e) {
    console.error("finances/overview", e);
    return res.status(500).json({ message: "Could not load finances." });
  }
}
