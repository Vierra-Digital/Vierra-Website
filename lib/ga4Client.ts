import { google } from "googleapis"
import { resolveGoogleWebClientCredentials } from "@/lib/googleOAuthClient"

export type WebsiteVisitsPoint = {
  week: string
  visits: number
}

export const EMPTY_WEEKLY_VISITS: WebsiteVisitsPoint[] = [
  { week: "Week 1", visits: 0 },
  { week: "Week 2", visits: 0 },
  { week: "Week 3", visits: 0 },
  { week: "Week 4", visits: 0 },
  { week: "Week 5", visits: 0 },
]

export function parseGa4Month(value: string | string[] | undefined) {
  const monthValue = Array.isArray(value) ? value[0] : value
  if (!monthValue) return null
  const match = monthValue.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || month < 1 || month > 12) return null
  return { year, month }
}

export function isGa4Configured() {
  const propertyId = (process.env.GA4_PROPERTY_ID || "").trim()
  const refreshToken = (process.env.GA4_OAUTH_REFRESH_TOKEN || "").trim()
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials()
  return !!(propertyId && refreshToken && clientId && clientSecret)
}

function getAuth() {
  if (!isGa4Configured()) return null
  const { clientId, clientSecret } = resolveGoogleWebClientCredentials()
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: process.env.GA4_OAUTH_REFRESH_TOKEN!.trim() })
  return oauth2
}

function monthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
  return { startDate: fmt(start), endDate: fmt(end) }
}

function bucketSessionsByWeek(rows: { dimensionValues?: { value?: string | null }[]; metricValues?: { value?: string | null }[] }[]) {
  const weekBuckets = [0, 0, 0, 0, 0]
  for (const row of rows) {
    const dateValue = row.dimensionValues?.[0]?.value || ""
    const day = Number(dateValue.slice(-2))
    if (!day) continue
    const weekIndex = Math.min(4, Math.floor((day - 1) / 7))
    const sessions = Number(row.metricValues?.[0]?.value || "0")
    if (!Number.isNaN(sessions)) weekBuckets[weekIndex] += sessions
  }
  return weekBuckets.map((visits, index) => ({
    week: `Week ${index + 1}`,
    visits,
  }))
}

export async function fetchWeeklyWebsiteVisits(year: number, month: number): Promise<WebsiteVisitsPoint[]> {
  const auth = getAuth()
  if (!auth) return EMPTY_WEEKLY_VISITS

  const propertyId = process.env.GA4_PROPERTY_ID!.trim()
  const { startDate, endDate } = monthDateRange(year, month)
  const analyticsData = google.analyticsdata({ version: "v1beta", auth })

  const report = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    },
  })

  return bucketSessionsByWeek(report.data.rows || [])
}
