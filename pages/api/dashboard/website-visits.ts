import type { NextApiRequest, NextApiResponse } from "next"
import {
  EMPTY_WEEKLY_VISITS,
  fetchWeeklyWebsiteVisits,
  isGa4Configured,
  parseGa4Month,
} from "@/lib/ga4Client"
import {
  getSessionRole,
  handleApiError,
  requireMethodOrRespond405,
  requireRolesOrRespond403,
  requireSessionOrRespond401,
} from "@/lib/api/guards"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    requireMethodOrRespond405(req, res, ["GET"])
    const session = await requireSessionOrRespond401(req, res)
    const role = getSessionRole(session)
    requireRolesOrRespond403(res, role, ["admin", "staff"])

    const parsedMonth = parseGa4Month(req.query.month)
    if (!parsedMonth) {
      res.status(400).json({ message: "Invalid month format. Use YYYY-MM." })
      return
    }

    if (!isGa4Configured()) {
      res.status(200).json({ configured: false, points: EMPTY_WEEKLY_VISITS })
      return
    }

    const points = await fetchWeeklyWebsiteVisits(parsedMonth.year, parsedMonth.month)
    res.status(200).json({ configured: true, points })
  } catch (error) {
    handleApiError(res, "/api/dashboard/website-visits error", error, "Failed to load website visits")
  }
}
