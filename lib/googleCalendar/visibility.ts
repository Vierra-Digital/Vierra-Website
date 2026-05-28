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

export async function getCalendarVisibilityPreferences(userId: number) {
  const rows = await prisma.userToken.findMany({
    where: {
      userId,
      platform: { startsWith: PLATFORM_PREFIX },
    },
    select: { platform: true, accessToken: true },
  })

  return rows
    .map((row) => {
      const parsed = parsePlatformKey(row.platform)
      if (!parsed) return null
      return {
        accountEmail: parsed.accountEmail,
        calendarId: parsed.calendarId,
        isEnabled: row.accessToken !== DISABLED_MARKER,
      }
    })
    .filter((row): row is CalendarVisibilityPreference => Boolean(row))
}

export async function upsertCalendarVisibilityPreference(params: {
  userId: number
  accountEmail: string
  calendarId: string
  isEnabled: boolean
}) {
  const normalizedEmail = params.accountEmail.trim().toLowerCase()
  const platform = makePlatformKey(normalizedEmail, params.calendarId)

  if (params.isEnabled) {
    await prisma.userToken.deleteMany({
      where: { userId: params.userId, platform },
    })
    return
  }

  await prisma.userToken.upsert({
    where: {
      userId_platform: {
        userId: params.userId,
        platform,
      } as any,
    },
    update: {
      accessToken: DISABLED_MARKER,
    },
    create: {
      userId: params.userId,
      platform,
      accessToken: DISABLED_MARKER,
    },
  })
}
