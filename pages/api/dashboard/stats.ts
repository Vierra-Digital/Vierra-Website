import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import {
  getSessionRole,
  handleApiError,
  requireMethodOrRespond405,
  requireRolesOrRespond403,
  requireSessionOrRespond401,
} from "@/lib/api/guards"

type GrowthDirection = "up" | "flat" | "down"

type StatCard = {
  key: "clients" | "meetingsBooked" | "campaigns" | "leadsGenerated"
  label: "Clients" | "Meetings Booked" | "Campaigns" | "Leads Generated"
  lifetimeValue: number
  currentMonthValue: number
  previousMonthValue: number
  growthPercent: number
  growthDirection: GrowthDirection
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

function calculateGrowth(current: number, previous: number) {
  const denominator = previous === 0 ? 1 : previous
  return Math.round((((current - previous) / denominator) * 100) * 10) / 10
}

function getGrowthDirection(current: number, previous: number): GrowthDirection {
  if (current > previous) return "up"
  if (current < previous) return "down"
  return "flat"
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireMethodOrRespond405(req, res, ["GET"])
    const session = await requireSessionOrRespond401(req, res)
    const role = getSessionRole(session)
    requireRolesOrRespond403(res, role, ["admin", "staff"])

    const userId = Number((session.user as any).id)
    const now = new Date()
    const { start: currentMonthStart, end: currentMonthEnd } = getUtcMonthRange(now)
    const { start: previousMonthStart, end: previousMonthEnd } = getPreviousUtcMonthRange(now)

    const [clientsLifetime, currentMonthClients, previousMonthClients, meetingsAgg] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({
        where: {
          createdAt: {
            gte: currentMonthStart,
            lt: currentMonthEnd,
          },
        },
      }),
      prisma.client.count({
        where: {
          createdAt: {
            gte: previousMonthStart,
            lt: previousMonthEnd,
          },
        },
      }),
      prisma.marketingTracker.groupBy({
        by: ["year", "month"],
        where: { userId },
        _sum: { meetingsSet: true },
      }),
    ])

    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1
    const previousMonthDate = new Date(Date.UTC(currentYear, now.getUTCMonth() - 1, 1))
    const previousYear = previousMonthDate.getUTCFullYear()
    const previousMonth = previousMonthDate.getUTCMonth() + 1

    const meetingsLifetime = meetingsAgg.reduce((total, row) => total + (row._sum.meetingsSet ?? 0), 0)
    const currentMonthMeetings =
      meetingsAgg.find((row) => row.year === currentYear && row.month === currentMonth)?._sum.meetingsSet ?? 0
    const previousMonthMeetings =
      meetingsAgg.find((row) => row.year === previousYear && row.month === previousMonth)?._sum.meetingsSet ?? 0

    const clientsGrowth = calculateGrowth(currentMonthClients, previousMonthClients)
    const meetingsGrowth = calculateGrowth(currentMonthMeetings, previousMonthMeetings)

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
        lifetimeValue: 0,
        currentMonthValue: 0,
        previousMonthValue: 0,
        growthPercent: 0,
        growthDirection: "flat",
      },
      {
        key: "leadsGenerated",
        label: "Leads Generated",
        lifetimeValue: 0,
        currentMonthValue: 0,
        previousMonthValue: 0,
        growthPercent: 0,
        growthDirection: "flat",
      },
    ]

    res.status(200).json({ stats })
  } catch (error) {
    handleApiError(res, "/api/dashboard/stats error", error, "Failed to load dashboard stats")
  }
}
