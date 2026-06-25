import { prisma } from "@/lib/prisma"

export type CalendarVisibilityPreference = {
  accountEmail: string
  calendarId: string
  isEnabled: boolean
}

const PLATFORM_PREFIX = "gcalvis:"
const DISABLED_MARKER = "__disabled__"

function makePlatformKey(accountEmail: string, calendarId: string) {
  return `${PLATFORM_PREFIX}${encodeURIComponent(accountEmail.trim().toLowerCase())}::${encodeURIComponent(calendarId)}`
}

function parsePlatformKey(platform: string) {
  if (!platform.startsWith(PLATFORM_PREFIX)) return null
  const raw = platform.slice(PLATFORM_PREFIX.length)
  const [emailPart, calendarPart] = raw.split("::")
  if (!emailPart || !calendarPart) return null
  return {
    accountEmail: decodeURIComponent(emailPart).trim().toLowerCase(),
    calendarId: decodeURIComponent(calendarPart),
  }
}

export function isCalendarVisibilityTableMissing(error: unknown) {
  void error
  return false
}

export async function getCalendarVisibilityPreferences(userId: string) {
  const rows = await prisma.platformToken.findMany({
    where: {
      user_id: userId,
      platform: { startsWith: PLATFORM_PREFIX },
    },
    select: { platform: true, access_token: true },
  })

  return rows
    .map((row) => {
      const parsed = parsePlatformKey(row.platform)
      if (!parsed) return null
      return {
        accountEmail: parsed.accountEmail,
        calendarId: parsed.calendarId,
        isEnabled: row.access_token !== DISABLED_MARKER,
      }
    })
    .filter((row): row is CalendarVisibilityPreference => Boolean(row))
}

export async function upsertCalendarVisibilityPreference(params: {
  userId: string
  accountEmail: string
  calendarId: string
  isEnabled: boolean
}) {
  const normalizedEmail = params.accountEmail.trim().toLowerCase()
  const platform = makePlatformKey(normalizedEmail, params.calendarId)

  if (params.isEnabled) {
    await prisma.platformToken.deleteMany({
      where: { user_id: params.userId, platform },
    })
    return
  }

  await prisma.platformToken.upsert({
    where: {
      user_id_platform: {
        user_id: params.userId,
        platform,
      },
    },
    update: {
      access_token: DISABLED_MARKER,
    },
    create: {
      user_id: params.userId,
      platform,
      access_token: DISABLED_MARKER,
    },
  })
}
