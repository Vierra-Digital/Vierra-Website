import { useState, useEffect, useMemo } from "react"
import { RiArrowDropDownLine } from "react-icons/ri"
import { FiTrendingUp, FiTrendingDown, FiMinus, FiCalendar, FiClock } from "react-icons/fi"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type GrowthDirection = "up" | "flat" | "down"
type DashboardStatKey =
    | "clients"
    | "meetingsBooked"
    | "campaigns"
    | "leadsGenerated"
    | "revenue"
    | "expenses"
    | "profit"

type DashboardStat = {
    key: DashboardStatKey
    label: string
    lifetimeValue: number
    currentMonthValue: number
    previousMonthValue: number
    growthPercent: number
    growthDirection: GrowthDirection
    isCurrency?: boolean
}

type UpcomingMeeting = {
    id: string
    title: string
    organizer: string
    startIso: string
    endIso: string | null
    timeZone: string
    meetingLink: string | null
}

/** "3m ago" / "2h ago" / a date — enough to judge whether an offline row is stale. */
function formatActiveSince(iso: string | null): string {
    if (!iso) return "Never"
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return "Never"
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
    if (mins < 1) return "Just Now"
    if (mins < 60) return `${mins} Min Ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours} ${hours === 1 ? "Hour" : "Hours"} Ago`
    const days = Math.round(hours / 24)
    return days < 7 ? `${days} ${days === 1 ? "Day" : "Days"} Ago` : new Date(iso).toLocaleDateString()
}

type StaffActivityRow = {
    userId: string
    name: string | null
    email: string | null
    role: string
    position: string | null
    status: string
    lastActiveAt: string | null
    isLive: boolean
}

type RecentPostRow = {
    id: string
    title: string
    slug: string
    publishedDate: string
    views: number
    author: string | null
}

type WebsiteVisitsPoint = { week: string; visits: number }

const DashboardSection = () => {
    const [clientNow, setClientNow] = useState<Date | null>(null)
    useEffect(() => {
        setClientNow(new Date())
    }, [])

    const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const MONTH_WINDOW = 6
    /**
     * Seeded on mount, not at render time.
     *
     * `new Date()` in the component body ran on the server (UTC) and again on the client (local
     * zone). Near a month boundary those disagree, so the server and client rendered different
     * <option> lists and React reported a hydration mismatch. Deferring to an effect means the
     * server renders no options and the client fills them in.
     */
    const now = clientNow ?? new Date(0)
    const monthOptions = Array.from({ length: MONTH_WINDOW }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const year = date.getFullYear()
        const monthIndex = date.getMonth()
        const monthName = allMonths[monthIndex] ?? "January"
        const value = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
        return {
            value,
            monthName,
            year,
            label: `${monthName} ${year}`,
        }
    }).reverse()
    const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    // Empty until clientNow lands, then pinned to the real current month. Seeding it from the
    // epoch placeholder used for SSR would leave the picker showing 1970's month.
    const [monthFilter, setMonthFilter] = useState("")
    useEffect(() => {
        if (clientNow && !monthFilter) setMonthFilter(currentMonthValue)
    }, [clientNow, currentMonthValue, monthFilter])
    const [statsLoading, setStatsLoading] = useState(true)
    const [statsCards, setStatsCards] = useState<DashboardStat[]>([])
    const [meetingsLoading, setMeetingsLoading] = useState(true)
    const [calendarConnected, setCalendarConnected] = useState(false)
    const [calendarNeedsReconnect, setCalendarNeedsReconnect] = useState(false)
    const [calendarIssueMessage, setCalendarIssueMessage] = useState("")
    const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([])
    const [websiteVisitsLoading, setWebsiteVisitsLoading] = useState(true)
    const [websiteVisitsConfigured, setWebsiteVisitsConfigured] = useState(false)
    const [websiteVisitsData, setWebsiteVisitsData] = useState<WebsiteVisitsPoint[]>([])
    const [staffActivity, setStaffActivity] = useState<StaffActivityRow[]>([])
    const [staffLoading, setStaffLoading] = useState(true)
    const [recentPosts, setRecentPosts] = useState<RecentPostRow[]>([])
    const [postsLoading, setPostsLoading] = useState(true)

    // Staff presence and the latest posts are independent of each other and of the stats, so they
    // load in parallel and each panel fills in on its own rather than gating the page.
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const [staffRes, postsRes] = await Promise.all([
                    fetch("/api/dashboard/staff-activity"),
                    fetch("/api/dashboard/recent-posts"),
                ])
                if (staffRes.ok) {
                    const data = await staffRes.json()
                    if (!cancelled && Array.isArray(data?.staff)) setStaffActivity(data.staff)
                }
                if (postsRes.ok) {
                    const data = await postsRes.json()
                    if (!cancelled && Array.isArray(data?.posts)) setRecentPosts(data.posts)
                }
            } catch {
                /* leave the panels empty; their empty states explain themselves */
            } finally {
                if (!cancelled) {
                    setStaffLoading(false)
                    setPostsLoading(false)
                }
            }
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                const response = await fetch("/api/dashboard/stats")
                if (response.ok) {
                    const data = await response.json()
                    if (Array.isArray(data?.stats)) {
                        setStatsCards(data.stats)
                    }
                }
            } catch (error) {
                console.error("Error fetching dashboard stats:", error)
            } finally {
                setStatsLoading(false)
            }
        }

        fetchDashboardStats()
    }, [])

    useEffect(() => {
        const fetchUpcomingMeetings = async () => {
            try {
                const response = await fetch("/api/dashboard/upcoming-meetings")
                if (!response.ok) {
                    setCalendarConnected(false)
                    setCalendarNeedsReconnect(false)
                    setCalendarIssueMessage("")
                    setUpcomingMeetings([])
                    return
                }
                const data = await response.json()
                setCalendarConnected(!!data?.connected)
                setCalendarNeedsReconnect(!!data?.needsReconnect)
                setCalendarIssueMessage(typeof data?.issueMessage === "string" ? data.issueMessage : "")
                setUpcomingMeetings(Array.isArray(data?.meetings) ? data.meetings : [])
            } catch (error) {
                console.error("Error fetching upcoming meetings:", error)
                setCalendarConnected(false)
                setCalendarNeedsReconnect(false)
                setCalendarIssueMessage("")
                setUpcomingMeetings([])
            } finally {
                setMeetingsLoading(false)
            }
        }

        fetchUpcomingMeetings()
    }, [])

    useEffect(() => {
        const fetchWebsiteVisits = async () => {
            setWebsiteVisitsLoading(true)
            try {
                if (!monthFilter) return
                // Re-enter the loading state on every month change, or the previous month's
                // series stays on screen while the new one is in flight.
                setWebsiteVisitsLoading(true)
                const response = await fetch(`/api/dashboard/website-visits?month=${encodeURIComponent(monthFilter)}`)
                if (!response.ok) {
                    setWebsiteVisitsConfigured(false)
                    setWebsiteVisitsData([])
                    return
                }
                const data = await response.json()
                setWebsiteVisitsConfigured(data?.configured !== false)
                setWebsiteVisitsData(Array.isArray(data?.points) ? data.points : [])
            } catch (error) {
                console.error("Error fetching website visits:", error)
                setWebsiteVisitsConfigured(false)
                setWebsiteVisitsData([])
            } finally {
                setWebsiteVisitsLoading(false)
            }
        }

        fetchWebsiteVisits()
    }, [monthFilter])

    const statOrder: DashboardStatKey[] = [
        "clients",
        "meetingsBooked",
        "campaigns",
        "leadsGenerated",
        "revenue",
        "expenses",
    ]
    const STAT_LABELS: Record<DashboardStatKey, string> = {
        clients: "Clients",
        meetingsBooked: "Meetings Booked",
        campaigns: "Campaigns",
        leadsGenerated: "Leads Generated",
        revenue: "Revenue",
        expenses: "Expenses",
        profit: "Profit",
    }
    const CURRENCY_STATS = new Set<DashboardStatKey>(["revenue", "expenses", "profit"])
    const orderedStats = statOrder.map((key) =>
        statsCards.find((card) => card.key === key) ?? {
            key,
            label: STAT_LABELS[key],
            lifetimeValue: 0,
            currentMonthValue: 0,
            previousMonthValue: 0,
            growthPercent: 0,
            growthDirection: "flat" as GrowthDirection,
            isCurrency: CURRENCY_STATS.has(key),
        }
    )

    const numberColorByStat: Record<DashboardStatKey, string> = {
        clients: "text-blue-600",
        meetingsBooked: "text-orange-600",
        campaigns: "text-purple-600",
        leadsGenerated: "text-green-600",
        revenue: "text-emerald-600",
        expenses: "text-rose-600",
        profit: "text-[#701CC0]",
    }

    const getTrendUi = (direction: GrowthDirection) => {
        if (direction === "up") {
            return {
                Icon: FiTrendingUp,
                valueClass: "text-green-600",
                iconClass: "text-green-600",
            }
        }
        if (direction === "down") {
            return {
                Icon: FiTrendingDown,
                valueClass: "text-red-600",
                iconClass: "text-red-600",
            }
        }
        return {
            Icon: FiMinus,
            valueClass: "text-gray-400",
            iconClass: "text-gray-400",
        }
    }

    const localTimeZone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        } catch {
            return "UTC"
        }
    }, [])

    /**
     * Drop anything already finished. The cache is synced periodically, so a meeting that ended
     * an hour ago is still in the payload and was being listed as "upcoming".
     */
    const futureMeetings = upcomingMeetings.filter((meeting) => {
        const end = new Date(meeting.endIso || meeting.startIso || 0).getTime()
        if (!Number.isFinite(end)) return true
        return clientNow ? end >= clientNow.getTime() : true
    })

    const formatMeetingDate = (iso: string) => {
        const date = new Date(iso)
        const now = new Date()
        const meetingDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: localTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date)
        const todayDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: localTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: localTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(tomorrow)

        if (meetingDay === todayDay) return "Today"
        if (meetingDay === tomorrowDay) return "Tomorrow"

        return new Intl.DateTimeFormat(undefined, {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            timeZone: localTimeZone,
        }).format(date)
    }

    const isMeetingToday = (iso: string) => {
        const date = new Date(iso)
        const now = new Date()
        const meetingDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: localTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date)
        const todayDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: localTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now)
        return meetingDay === todayDay
    }

    const formatMeetingTime = (iso: string) => {
        const date = new Date(iso)
        return new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: localTimeZone,
        }).format(date)
    }

    const localTimeZoneAbbreviation = (iso: string) => {
        const date = new Date(iso)
        return new Intl.DateTimeFormat(undefined, {
            timeZone: localTimeZone,
            timeZoneName: "short",
        })
            .formatToParts(date)
            .find((part) => part.type === "timeZoneName")?.value
    }

    const formatMeetingTimeRange = (startIso: string, endIso: string | null) => {
        const start = formatMeetingTime(startIso)
        const range = endIso ? `${start} - ${formatMeetingTime(endIso)}` : start
        const zoneAbbreviation = localTimeZoneAbbreviation(startIso)
        return zoneAbbreviation ? `${range} ${zoneAbbreviation}` : range
    }

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col">
            <div className="dashboard-scroll-area flex-1 px-8 lg:px-14 pt-1 overflow-y-auto overflow-x-hidden">
                <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full pb-16">
            <div className="w-full flex justify-between items-center mb-2">
                <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-[#111827] mt-8 mb-6">Dashboard</h1>
                <div />
            </div>

            
            <div className="flex gap-4">
                
                <div className="flex-1">
                    
                    <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3 xl:grid-cols-6">
                        {orderedStats.map((card) => {
                            const trendUi = getTrendUi(card.growthDirection)
                            const TrendIcon = trendUi.Icon
                            const roundedGrowth = Number(card.growthPercent.toFixed(1))
                            const growthLabel = roundedGrowth % 1 === 0 ? `${roundedGrowth.toFixed(0)}%` : `${roundedGrowth}%`
                            const isMoney = card.isCurrency || CURRENCY_STATS.has(card.key)
                            const displayValue = statsLoading
                                ? "..."
                                : isMoney
                                  ? card.lifetimeValue.toLocaleString(undefined, {
                                        style: "currency",
                                        currency: "USD",
                                        maximumFractionDigits: 0,
                                    })
                                  : card.lifetimeValue.toLocaleString()

                            return (
                                <div key={card.key} className="group bg-[#FBFAFC] rounded-xl px-3.5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors duration-150 hover:bg-[#F7F5FA]">
                                    <div className="mb-1.5">
                                        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">{card.label}</h3>
                                    </div>
                                    {statsLoading ? (
                                        <div className="dash-skeleton mb-2 h-[22px] w-16 rounded" />
                                    ) : (
                                        <div className={`text-[22px] font-semibold leading-none tracking-[-0.02em] mb-1.5 ${numberColorByStat[card.key]}`}>
                                            {displayValue}
                                        </div>
                                    )}
                                    <div className={`flex items-center text-[12px] font-medium ${trendUi.valueClass}`}>
                                        {statsLoading ? (
                                            <span className="dash-skeleton h-3 w-10 rounded" />
                                        ) : (
                                            <>
                                                <TrendIcon className={`w-3 h-3 mr-1 ${trendUi.iconClass}`} />
                                                {growthLabel}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    
                    {/* Chart and Recent Posts share a row: the chart alone left its right side empty
                        on wide screens. */}
                    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="bg-[#FBFAFC] rounded-xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-[#111827]">Website Visits</h3>
                            <div className="relative">
                                <select
                                    value={monthFilter}
                                    onChange={(e) => setMonthFilter(e.target.value)}
                                    className="appearance-none bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-sm text-[#6B7280] pr-8 cursor-pointer hover:bg-gray-50"
                                >
                                    {monthOptions.map((month) => (
                                        <option key={month.value} value={month.value}>
                                            {month.label}
                                        </option>
                                    ))}
                                </select>
                                <RiArrowDropDownLine className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                            </div>
                        </div>
                        <div className="h-64 rounded-lg p-3">
                            {websiteVisitsLoading ? (
                                /* Bars rather than a spinner or a line of text: the chart's own
                                   shape, so switching months doesn't collapse the panel's height
                                   and then snap back. */
                                <div className="flex h-full w-full items-end gap-2 px-1 pb-5">
                                    {[38, 62, 46, 74, 55, 68, 42].map((h, i) => (
                                        <div
                                            key={i}
                                            className="dash-skeleton flex-1 rounded-t-md"
                                            style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                                        />
                                    ))}
                                </div>
                            ) : !websiteVisitsConfigured ? (
                                <div className="h-full w-full flex items-center justify-center text-sm text-[#6B7280] text-center px-6">
                                    Website visits not connected. Run{" "}
                                    <code className="mx-1 text-xs bg-white px-1.5 py-0.5 rounded border">npm run connect-ga4</code>{" "}
                                    and set <code className="text-xs">GA4_PROPERTY_ID</code> in .env.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={websiteVisitsData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                                        {/* Vertical fade so the fill reads as area under the curve
                                            rather than a solid purple block. */}
                                        <defs>
                                            <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#701CC0" stopOpacity={0.28} />
                                                <stop offset="100%" stopColor="#701CC0" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
                                        <YAxis stroke="#6B7280" fontSize={12} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB', 
                                                borderRadius: '8px',
                                                fontSize: '12px'
                                            }} 
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="visits"
                                            name="Visits"
                                            stroke="#701CC0"
                                            strokeWidth={2.5}
                                            fill="url(#visitsFill)"
                                            dot={{ fill: '#701CC0', strokeWidth: 2, r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
<div className="bg-[#FBFAFC] rounded-xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] flex flex-col">
                            <h3 className="text-lg font-semibold text-[#111827] mb-3">Recent Posts</h3>
                            {postsLoading ? (
                                <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="dash-skeleton h-9 rounded-lg" style={{ animationDelay: `${i * 70}ms` }} />
                                    ))}
                                </div>
                            ) : recentPosts.length === 0 ? (
                                <p className="text-xs text-[#6B7280]">No published posts yet.</p>
                            ) : (
                                <ul className="flex-1 divide-y divide-[#F1EFF5] flex flex-col justify-between">
                                    {recentPosts.map((post) => (
                                        <li key={post.id} className="flex items-center gap-2.5 py-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] font-medium text-[#111827]">{post.title}</p>
                                                <p className="text-[11px] text-[#9CA3AF]">
                                                    {new Date(post.publishedDate).toLocaleDateString(undefined, {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-[#F3EDFB] px-2 py-0.5 text-[11px] font-medium text-[#701CC0]">
                                                {post.views.toLocaleString()} {post.views === 1 ? "View" : "Views"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Staff Activity sits under the chart at the same width as Recent Posts, so
                        the two read as a matched pair rather than one wide and one narrow. */}
                    <div className="mb-4 w-full max-w-[320px]">
                        <div className="bg-[#FBFAFC] rounded-xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-3">Staff Activity</h3>
                            {staffLoading ? (
                                <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="dash-skeleton h-9 rounded-lg" style={{ animationDelay: `${i * 70}ms` }} />
                                    ))}
                                </div>
                            ) : staffActivity.length === 0 ? (
                                <p className="text-xs text-[#6B7280]">No teammates yet.</p>
                            ) : (
                                <ul className="divide-y divide-[#F1EFF5]">
                                    {staffActivity.map((row) => (
                                        <li key={row.userId} className="flex items-center gap-2.5 py-2">
                                            <span
                                                className={`h-2 w-2 shrink-0 rounded-full ${
                                                    row.isLive
                                                        ? "bg-emerald-500"
                                                        : row.status === "away" || row.status === "busy"
                                                          ? "bg-amber-400"
                                                          : "bg-[#D1D5DB]"
                                                }`}
                                                aria-hidden
                                            />
                                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#111827]">
                                                {row.name || row.email || "Unknown"}
                                            </span>
                                            <span className="shrink-0 text-[11px] text-[#6B7280]">
                                                {row.isLive ? "Active Now" : formatActiveSince(row.lastActiveAt)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                </div>

                
                <div className="w-[400px] shrink-0 space-y-4">
                    <div className="bg-[#FBFAFC] rounded-xl p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-[#111827]">Upcoming Meetings</h3>
                        </div>
                        {meetingsLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="rounded-lg bg-white p-3">
                                        <div className="dash-skeleton mb-2 h-3.5 w-3/4 rounded" style={{ animationDelay: `${i * 80}ms` }} />
                                        <div className="dash-skeleton mb-2.5 h-3 w-1/2 rounded" style={{ animationDelay: `${i * 80 + 50}ms` }} />
                                        <div className="dash-skeleton h-8 w-full rounded-md" style={{ animationDelay: `${i * 80 + 90}ms` }} />
                                    </div>
                                ))}
                            </div>
                        ) : false ? (
                            <div className="text-sm text-[#6B7280]">Loading upcoming meetings...</div>
                        ) : !calendarConnected ? (
                            <div className="rounded-lg bg-white p-3">
                                <p className="text-sm text-[#374151]">
                                    Connect your Google Gmail account in settings to load upcoming meetings.
                                </p>
                            </div>
                        ) : calendarNeedsReconnect ? (
                            <div className="rounded-lg bg-white p-3">
                                <p className="text-sm text-[#6B7280]">
                                    Reconnect your Google account in settings to grant calendar access, then refresh this page.
                                </p>
                                {calendarIssueMessage ? (
                                    <p className="mt-2 text-xs text-[#9CA3AF]">{calendarIssueMessage}</p>
                                ) : null}
                            </div>
                        ) : futureMeetings.length === 0 ? (
                            <div className="rounded-lg bg-white p-3 flex flex-col items-center text-center">
                                <div className="relative mb-3 flex h-14 w-14 items-center justify-center">
                                    <div className="meeting-empty-ping absolute inset-0 rounded-full bg-[#E9D5FF]" />
                                    <div className="meeting-empty-icon relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-[#E9D5FF]">
                                        <FiCalendar className="h-5 w-5 text-[#701CC0]" />
                                    </div>
                                </div>
                                <p className="text-sm text-[#6B7280]">No upcoming meetings found in your connected calendars.</p>
                                {calendarIssueMessage ? (
                                    <p className="mt-2 text-xs text-[#9CA3AF]">{calendarIssueMessage}</p>
                                ) : null}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {futureMeetings.map((meeting) => (
                                    <div key={meeting.id} className="p-3 bg-white rounded-lg">
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm mb-2">{meeting.title}</div>
                                            <div className="flex items-center gap-2.5 mb-2">
                                                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                    <FiCalendar className="w-3 h-3" />
                                                    <span className={isMeetingToday(meeting.startIso) ? "text-red-600 font-semibold" : ""}>
                                                        {formatMeetingDate(meeting.startIso)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                    <FiClock className="w-3 h-3" />
                                                    {formatMeetingTimeRange(meeting.startIso, meeting.endIso)}
                                                </div>
                                            </div>
                                            {meeting.meetingLink ? (
                                                <a
                                                    href={meeting.meetingLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex w-full items-center justify-center px-3 py-2 text-xs bg-[#701CC0] text-white rounded hover:bg-[#5f17a5] transition"
                                                >
                                                    Join Meeting
                                                </a>
                                            ) : (
                                                <div className="inline-flex w-full items-center justify-center px-3 py-2 text-xs bg-gray-200 text-gray-600 rounded">
                                                    No Meeting Link
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </div>
        </div>
        <style jsx>{`
            .dashboard-scroll-area {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }

            .dashboard-scroll-area::-webkit-scrollbar {
                display: none;
            }

            .meeting-empty-ping {
                animation: meetingPulse 1.8s ease-out infinite;
            }

            .meeting-empty-icon {
                animation: meetingFloat 2.4s ease-in-out infinite;
            }

            @keyframes meetingPulse {
                0% {
                    transform: scale(0.75);
                    opacity: 0.85;
                }
                70% {
                    transform: scale(1.35);
                    opacity: 0;
                }
                100% {
                    transform: scale(1.35);
                    opacity: 0;
                }
            }

            @keyframes meetingFloat {
                0%,
                100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-3px);
                }
            }
        `}</style>
        </div>
    )
}

export default DashboardSection;