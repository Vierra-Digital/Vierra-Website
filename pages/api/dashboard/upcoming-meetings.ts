import { withAuth } from "@/lib/api/withAuth"
import { handleApiError } from "@/lib/api/guards"
import { readCachedUpcomingMeetings, syncUpcomingMeetingsForUser } from "@/lib/dashboard/upcomingMeetings"

/**
 * Serves the DB-cached result written by the meetings-sync cron (see
 * lib/dashboard/upcomingMeetings.ts and pages/api/dashboard/meetings-sync/dispatch.ts) instead
 * of hitting the live Google Calendar API on every dashboard load. Falls back to a one-time
 * inline sync only when this user has never been synced yet (e.g. they just connected Gmail
 * and no cron tick has run for them) — every request after that reads the cache.
 */
export default withAuth(async (req, res, session) => {
  try {
    const userId = session.user.id
    const cached = await readCachedUpcomingMeetings(userId)
    if (cached) {
      res.status(200).json(cached)
      return
    }

    const result = await syncUpcomingMeetingsForUser(userId)
    res.status(200).json(result)
  } catch (error) {
    handleApiError(res, "/api/dashboard/upcoming-meetings error", error, "Failed to load upcoming meetings")
  }
}, { methods: ["GET"], roles: ["admin", "staff"] })
