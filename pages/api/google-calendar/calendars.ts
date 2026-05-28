import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth"
import { getValidGmailAccessToken } from "@/lib/gmail/tokens"
import {
  getCalendarVisibilityPreferences,
  isCalendarVisibilityTableMissing,
  upsertCalendarVisibilityPreference,
} from "@/lib/googleCalendar/visibility"

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string
    summary?: string
    hidden?: boolean
    accessRole?: string
    timeZone?: string
  }>
}

function canReadCalendar(accessRole: string | undefined) {
  if (!accessRole) return false
  return ["freeBusyReader", "reader", "writer", "owner"].includes(accessRole)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) {
    res.status(401).json({ message: "Not authenticated" })
    return
  }

  const userId = Number((session.user as any).id)
  if (!Number.isFinite(userId)) {
    res.status(400).json({ message: "Invalid session user id" })
    return
  }

  if (req.method === "GET") {
    try {
      const tokenRows = await prisma.userToken.findMany({
        where: { userId, platform: { startsWith: "gmail:" } },
        select: { platform: true },
        orderBy: { createdAt: "desc" },
      })

      if (!tokenRows.length) {
        res.status(200).json({ accounts: [] })
        return
      }

      const visibilityRows = await getCalendarVisibilityPreferences(userId).catch((error) => {
        if (isCalendarVisibilityTableMissing(error)) return []
        throw error
      })
      const visibilityMap = new Map(visibilityRows.map((row) => [`${row.accountEmail}::${row.calendarId}`, row.isEnabled]))

      const accounts = await Promise.all(
        tokenRows.map(async (row) => {
          const accountEmail = row.platform.replace(/^gmail:/, "").trim().toLowerCase()
          const tokenResult = await getValidGmailAccessToken(userId, accountEmail)
          if (!tokenResult.ok) {
            return { email: accountEmail, connected: false, calendars: [] as any[] }
          }

          const calendarListRes = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=false&showDeleted=false",
            { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
          )
          if (!calendarListRes.ok) {
            return { email: accountEmail, connected: true, calendars: [] as any[] }
          }

          const calendarListJson = (await calendarListRes.json()) as GoogleCalendarListResponse
          const calendars = (calendarListJson.items || [])
            .filter((calendar) => calendar.id && !calendar.hidden && canReadCalendar(calendar.accessRole))
            .map((calendar) => {
              const id = calendar.id as string
              const key = `${accountEmail}::${id}`
              return {
                id,
                summary: calendar.summary || id,
                timeZone: calendar.timeZone || "UTC",
                enabled: visibilityMap.get(key) ?? true,
              }
            })
            .sort((a, b) => a.summary.localeCompare(b.summary))

          return { email: accountEmail, connected: true, calendars }
        })
      )

      res.status(200).json({ accounts })
      return
    } catch (error) {
      console.error("/api/google-calendar/calendars GET error", error)
      res.status(500).json({ message: "Failed to load calendar settings" })
      return
    }
  }

  if (req.method === "POST") {
    try {
      const accountEmail = String(req.body?.accountEmail || "").trim().toLowerCase()
      const calendarId = String(req.body?.calendarId || "").trim()
      const enabled = Boolean(req.body?.enabled)

      if (!accountEmail || !calendarId) {
        res.status(400).json({ message: "accountEmail and calendarId are required" })
        return
      }

      await upsertCalendarVisibilityPreference({
        userId,
        accountEmail,
        calendarId,
        isEnabled: enabled,
      })

      res.status(200).json({ ok: true })
      return
    } catch (error) {
      if (isCalendarVisibilityTableMissing(error)) {
        res.status(500).json({ message: "Calendar settings table is missing. Run Prisma migration first." })
        return
      }
      console.error("/api/google-calendar/calendars POST error", error)
      res.status(500).json({ message: "Failed to update calendar setting" })
      return
    }
  }

  res.status(405).json({ message: "Method not allowed" })
}
