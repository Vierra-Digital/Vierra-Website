import { prisma } from "@/lib/prisma"

export type CalendarVisibilityPreference = {
  accountEmail: string
  calendarId: string
  isEnabled: boolean
}

const PLATFORM_PREFIX = "gcalvis:"
const DISABLED_MARKER = "__disabled__"
const ENABLED_MARKER = "__enabled__"

/**
 * Whether a calendar is on when the user has never said either way.
 *
 * Google hands every account a pile of calendars it generated or the user once subscribed to —
 * "Holidays in United States", birthdays, shared team calendars — and every one of them used to
 * default to visible. Upcoming meetings filled with public holidays as a result.
 *
 * Only the account's own primary calendar is on by default. Everything else is opt-in, which also
 * gives the right answer when several Gmail accounts are connected: each contributes its own
 * calendar rather than the first account's holidays being the loudest thing on the dashboard.
 */
export function isCalendarEnabledByDefault(params: {
  accountEmail: string
  calendarId: string
  primary?: boolean
}) {
  if (params.primary === true) return true
  // Google gives the primary calendar the account's own address as its id.
  return params.calendarId.trim().toLowerCase() === params.accountEmail.trim().toLowerCase()
}

/** Stored preference if there is one, otherwise the default above. */
export function resolveCalendarVisibility(
  visibilityMap: Map<string, boolean>,
  params: { accountEmail: string; calendarId: string; primary?: boolean }
) {
  const key = `${params.accountEmail.trim().toLowerCase()}::${params.calendarId}`
  return visibilityMap.get(key) ?? isCalendarEnabledByDefault(params)
}

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

  const marker = params.isEnabled ? ENABLED_MARKER : DISABLED_MARKER
  await prisma.platformToken.upsert({
    where: {
      user_id_platform: {
        user_id: params.userId,
        platform,
      },
    },
    update: { access_token: marker },
    create: {
      user_id: params.userId,
      platform,
      access_token: marker,
    },
  })
}
