import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/withAuth"
import { resolveTargetCompanyId, hasExplicitTargetCompanyId } from "@/lib/api/targetCompany"

type GrowthDirection = "up" | "flat" | "down"

type StatCard = {
  key: "clients" | "meetingsBooked" | "campaigns" | "leadsGenerated" | "revenue" | "expenses" | "profit"
  label: "Clients" | "Meetings Booked" | "Campaigns" | "Leads Generated" | "Revenue" | "Expenses" | "Profit"
  lifetimeValue: number
  currentMonthValue: number
  previousMonthValue: number
  growthPercent: number
  growthDirection: GrowthDirection
  /** Cards whose values are money, so the UI formats them as currency rather than counts. */
  isCurrency?: boolean
}

function getUtcMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  return { start, end }
}

function getPreviousUtcMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
  return { start, end }
}

/**
 * Month-over-month change as a percentage.
 *
 * With no prior-month baseline there is no true percentage, so this reports a flat 100% for
 * "went from nothing to something" rather than dividing by 1 — which is what produced 300% for
 * 0 -> 3 and would have produced 1200% for 0 -> 12. Both months at zero is 0%.
 */
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round((((current - previous) / previous) * 100) * 10) / 10
}

function getGrowthDirection(current: number, previous: number): GrowthDirection {
  if (current > previous) return "up"
  if (current < previous) return "down"
  return "flat"
}

export default withAuth(async (req, res, session) => {
  try {
    const userId = session.user.id
    /**
     * A staff member who has not picked a client yet sees the whole company, not an error.
     *
     * resolveTargetCompanyId always resolves to *some* companyId now — Vierra's own, as a
     * fallback for staff using tools like Cartography/Contacts on Vierra's own behalf (see
     * lib/api/targetCompany.ts) — so it can no longer be used here to detect "no client chosen".
     * hasExplicitTargetCompanyId answers that instead: unset means "all of them" (merged view),
     * exactly as before role model v2 introduced the Vierra fallback. Picking a client narrows it.
     *
     * A client session always counts as explicit, so it can never reach the wider view.
     */
    const merged = session.kind === "member" && !hasExplicitTargetCompanyId(session, req)
    const companyId = resolveTargetCompanyId(session, req)
    if (!merged && !companyId) {
      res.status(400).json({ message: "companyId is required" })
      return
    }
    const scope = merged ? {} : { company_id: companyId! }
    const campaignScope = merged ? {} : { campaigns: { company_id: companyId! } }
    const now = new Date()
    const { start: currentMonthStart, end: currentMonthEnd } = getUtcMonthRange(now)
    const { start: previousMonthStart, end: previousMonthEnd } = getPreviousUtcMonthRange(now)

    // Money is stored in integer cents on finance_entries; sum per kind per month window.
    const sumFinance = async (kind: "revenue" | "expense", start: Date, end: Date) => {
      const agg = await prisma.financeEntry.aggregate({
        where: { ...scope, kind, occurred_at: { gte: start, lt: end } },
        _sum: { amount_cents: true },
      })
      return (agg._sum.amount_cents ?? 0) / 100
    }

    const [
      clientsLifetime,
      currentMonthClients,
      previousMonthClients,
      meetingsAgg,
      campaignsLifetime,
      currentMonthCampaigns,
      previousMonthCampaigns,
      leadsLifetime,
      currentMonthLeads,
      previousMonthLeads,
      revenueThisMonth,
      revenueLastMonth,
      expensesThisMonth,
      expensesLastMonth,
    ] = await Promise.all([
      /**
       * Clients are counted across every company, not within the target one.
       *
       * A client belongs to its own company, so filtering by company_id counts the clients
       * *inside* whichever company is selected — which is always none, and why this tile read 0
       * with clients plainly in the list. The Clients page is unscoped for the same reason (role
       * model v2: every Vierra staff member sees every client), and these two must agree.
       *
       * Everything below stays on companyId: campaigns, leads and money belong to the selected
       * client, so they are scoped to it.
       */
      prisma.client.count(),
      prisma.client.count({
        where: { created_at: { gte: currentMonthStart, lt: currentMonthEnd } },
      }),
      prisma.client.count({
        where: { created_at: { gte: previousMonthStart, lt: previousMonthEnd } },
      }),
      prisma.marketingTracker.groupBy({
        by: ["year", "month"],
        where: { user_id: userId },
        _sum: { meetings_set: true },
      }),
      prisma.campaign.count({ where: scope }),
      prisma.campaign.count({
        where: {
          ...scope,
          created_at: {
            gte: currentMonthStart,
            lt: currentMonthEnd,
          },
        },
      }),
      prisma.campaign.count({
        where: {
          ...scope,
          created_at: {
            gte: previousMonthStart,
            lt: previousMonthEnd,
          },
        },
      }),
      prisma.campaignContact.count({ where: campaignScope }),
      prisma.campaignContact.count({
        where: {
          ...campaignScope,
          enrolled_at: {
            gte: currentMonthStart,
            lt: currentMonthEnd,
          },
        },
      }),
      prisma.campaignContact.count({
        where: {
          ...campaignScope,
          enrolled_at: {
            gte: previousMonthStart,
            lt: previousMonthEnd,
          },
        },
      }),
      sumFinance("revenue", currentMonthStart, currentMonthEnd),
      sumFinance("revenue", previousMonthStart, previousMonthEnd),
      sumFinance("expense", currentMonthStart, currentMonthEnd),
      sumFinance("expense", previousMonthStart, previousMonthEnd),
    ])

    const profitThisMonth = revenueThisMonth - expensesThisMonth
    const profitLastMonth = revenueLastMonth - expensesLastMonth

    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1
    const previousMonthDate = new Date(Date.UTC(currentYear, now.getUTCMonth() - 1, 1))
    const previousYear = previousMonthDate.getUTCFullYear()
    const previousMonth = previousMonthDate.getUTCMonth() + 1

    const meetingsLifetime = meetingsAgg.reduce((total, row) => total + (row._sum.meetings_set ?? 0), 0)
    const currentMonthMeetings =
      meetingsAgg.find((row) => row.year === currentYear && row.month === currentMonth)?._sum.meetings_set ?? 0
    const previousMonthMeetings =
      meetingsAgg.find((row) => row.year === previousYear && row.month === previousMonth)?._sum.meetings_set ?? 0

    const clientsGrowth = calculateGrowth(currentMonthClients, previousMonthClients)
    const meetingsGrowth = calculateGrowth(currentMonthMeetings, previousMonthMeetings)
    const campaignsGrowth = calculateGrowth(currentMonthCampaigns, previousMonthCampaigns)
    const leadsGrowth = calculateGrowth(currentMonthLeads, previousMonthLeads)

    const stats: StatCard[] = [
      {
        key: "clients",
        label: "Clients",
        lifetimeValue: clientsLifetime,
        currentMonthValue: currentMonthClients,
        previousMonthValue: previousMonthClients,
        growthPercent: clientsGrowth,
        growthDirection: getGrowthDirection(currentMonthClients, previousMonthClients),
      },
      {
        key: "meetingsBooked",
        label: "Meetings Booked",
        lifetimeValue: meetingsLifetime,
        currentMonthValue: currentMonthMeetings,
        previousMonthValue: previousMonthMeetings,
        growthPercent: meetingsGrowth,
        growthDirection: getGrowthDirection(currentMonthMeetings, previousMonthMeetings),
      },
      {
        key: "campaigns",
        label: "Campaigns",
        lifetimeValue: campaignsLifetime,
        currentMonthValue: currentMonthCampaigns,
        previousMonthValue: previousMonthCampaigns,
        growthPercent: campaignsGrowth,
        growthDirection: getGrowthDirection(currentMonthCampaigns, previousMonthCampaigns),
      },
      {
        key: "leadsGenerated",
        label: "Leads Generated",
        lifetimeValue: leadsLifetime,
        currentMonthValue: currentMonthLeads,
        previousMonthValue: previousMonthLeads,
        growthPercent: leadsGrowth,
        growthDirection: getGrowthDirection(currentMonthLeads, previousMonthLeads),
      },
      {
        key: "revenue",
        label: "Revenue",
        lifetimeValue: revenueThisMonth,
        currentMonthValue: revenueThisMonth,
        previousMonthValue: revenueLastMonth,
        growthPercent: calculateGrowth(revenueThisMonth, revenueLastMonth),
        growthDirection: getGrowthDirection(revenueThisMonth, revenueLastMonth),
        isCurrency: true,
      },
      {
        key: "expenses",
        label: "Expenses",
        lifetimeValue: expensesThisMonth,
        currentMonthValue: expensesThisMonth,
        previousMonthValue: expensesLastMonth,
        growthPercent: calculateGrowth(expensesThisMonth, expensesLastMonth),
        // Spending more is not "up" in the good sense, but direction here is literal —
        // the card colours the arrow, and inverting it only for expenses would mislead.
        growthDirection: getGrowthDirection(expensesThisMonth, expensesLastMonth),
        isCurrency: true,
      },
      {
        key: "profit",
        label: "Profit",
        lifetimeValue: profitThisMonth,
        currentMonthValue: profitThisMonth,
        previousMonthValue: profitLastMonth,
        growthPercent: calculateGrowth(profitThisMonth, profitLastMonth),
        growthDirection: getGrowthDirection(profitThisMonth, profitLastMonth),
        isCurrency: true,
      },
    ]

    res.setHeader("Cache-Control", "private, max-age=20")
    res.status(200).json({ stats })
  } catch (error) {
    console.error("/api/dashboard/stats error", error)
    res.status(500).json({ message: "Failed to load dashboard stats" })
  }
}, { methods: ["GET"], roles: ["admin", "staff"] })
