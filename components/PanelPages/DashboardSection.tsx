import React, { useState, useEffect } from "react"
import { RiArrowDropDownLine } from "react-icons/ri"
import { FiTrendingUp, FiTrendingDown, FiMinus, FiCalendar, FiClock } from "react-icons/fi"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type GrowthDirection = "up" | "flat" | "down"
type DashboardStatKey = "clients" | "meetingsBooked" | "campaigns" | "leadsGenerated"

type DashboardStat = {
    key: DashboardStatKey
    label: string
    lifetimeValue: number
    currentMonthValue: number
    previousMonthValue: number
    growthPercent: number
    growthDirection: GrowthDirection
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

type WebsiteVisitsPoint = { week: string; visits: number }

const DashboardSection = () => {
    const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const MONTH_WINDOW = 6
    const now = new Date()
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
    const [monthFilter, setMonthFilter] = useState(currentMonthValue)
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

    const statOrder: DashboardStatKey[] = ["clients", "meetingsBooked", "campaigns", "leadsGenerated"]
    const orderedStats = statOrder.map((key) =>
        statsCards.find((card) => card.key === key) ?? {
            key,
            label:
                key === "clients"
                    ? "Clients"
                    : key === "meetingsBooked"
                        ? "Meetings Booked"
                        : key === "campaigns"
                            ? "Campaigns"
                            : "Leads Generated",
            lifetimeValue: 0,
            currentMonthValue: 0,
            previousMonthValue: 0,
            growthPercent: 0,
            growthDirection: "flat" as GrowthDirection,
        }
    )

    const numberColorByStat: Record<DashboardStatKey, string> = {
        clients: "text-blue-600",
        meetingsBooked: "text-orange-600",
        campaigns: "text-purple-600",
        leadsGenerated: "text-green-600",
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

    const formatMeetingDate = (iso: string, timeZone: string) => {
        const date = new Date(iso)
        const now = new Date()
        const meetingDay = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date)
        const todayDay = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDay = new Intl.DateTimeFormat("en-CA", {
            timeZone,
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
            timeZone,
        }).format(date)
    }

    const isMeetingToday = (iso: string, timeZone: string) => {
        const date = new Date(iso)
        const now = new Date()
        const meetingDay = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date)
        const todayDay = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now)
        return meetingDay === todayDay
    }

    const formatMeetingTime = (iso: string, timeZone: string) => {
        const date = new Date(iso)
        return new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone,
        }).format(date)
    }

    const formatMeetingTimeRange = (startIso: string, endIso: string | null, timeZone: string) => {
        const start = formatMeetingTime(startIso, timeZone)
        if (!endIso) return start
        return `${start} - ${formatMeetingTime(endIso, timeZone)}`
    }

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col">
            <div className="dashboard-scroll-area flex-1 flex justify-center px-6 pt-2 overflow-y-auto">
                <div className="w-full max-w-6xl flex flex-col h-full pb-16">
            <div className="w-full flex justify-between items-center mb-2">
                <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Dashboard</h1>
                <div />
            </div>

            
            <div className="flex gap-6">
                
                <div className="flex-1">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {orderedStats.map((card) => {
                            const trendUi = getTrendUi(card.growthDirection)
                            const TrendIcon = trendUi.Icon
                            const roundedGrowth = Number(card.growthPercent.toFixed(1))
                            const growthLabel = roundedGrowth % 1 === 0 ? `${roundedGrowth.toFixed(0)}%` : `${roundedGrowth}%`
                            const displayValue = statsLoading ? "..." : card.lifetimeValue.toLocaleString()

                            return (
                                <div key={card.key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                    <div className="mb-2">
                                        <h3 className="text-sm font-medium text-[#6B7280] uppercase">{card.label}</h3>
                                    </div>
                                    <div className={`text-2xl font-bold mb-1 ${numberColorByStat[card.key]}`}>
                                        {displayValue}
                                    </div>
                                    <div className={`flex items-center text-sm ${trendUi.valueClass}`}>
                                        <TrendIcon className={`w-3 h-3 mr-1 ${trendUi.iconClass}`} />
                                        {statsLoading ? "..." : growthLabel}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
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
                        <div className="h-80 bg-gray-50 rounded-lg p-4 shadow-inner">
                            {websiteVisitsLoading ? (
                                <div className="h-full w-full flex items-center justify-center text-sm text-[#6B7280]">
                                    Loading website visits...
                                </div>
                            ) : !websiteVisitsConfigured ? (
                                <div className="h-full w-full flex items-center justify-center text-sm text-[#6B7280] text-center px-6">
                                    Website visits not connected. Run{" "}
                                    <code className="mx-1 text-xs bg-white px-1.5 py-0.5 rounded border">npm run connect-ga4</code>{" "}
                                    and set <code className="text-xs">GA4_PROPERTY_ID</code> in .env.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={websiteVisitsData}>
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
                                        <Line 
                                            type="monotone" 
                                            dataKey="visits"
                                            name="Visits"
                                            stroke="#701CC0" 
                                            strokeWidth={3}
                                            dot={{ fill: '#701CC0', strokeWidth: 2, r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                </div>

                
                <div className="w-80 space-y-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-[#111827]">Upcoming Meetings</h3>
                        </div>
                        {meetingsLoading ? (
                            <div className="text-sm text-[#6B7280]">Loading upcoming meetings...</div>
                        ) : !calendarConnected ? (
                            <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                                <p className="text-sm text-[#374151]">
                                    Connect your Google Gmail account in settings to load upcoming meetings.
                                </p>
                            </div>
                        ) : calendarNeedsReconnect ? (
                            <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                                <p className="text-sm text-[#6B7280]">
                                    Reconnect your Google account in settings to grant calendar access, then refresh this page.
                                </p>
                                {calendarIssueMessage ? (
                                    <p className="mt-2 text-xs text-[#9CA3AF]">{calendarIssueMessage}</p>
                                ) : null}
                            </div>
                        ) : upcomingMeetings.length === 0 ? (
                            <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4 flex flex-col items-center text-center">
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
                                {upcomingMeetings.map((meeting) => (
                                    <div key={meeting.id} className="p-4 bg-gray-50 rounded-lg">
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm mb-2">{meeting.title}</div>
                                            <div className="flex items-center gap-4 mb-3">
                                                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                    <FiCalendar className="w-3 h-3" />
                                                    <span className={isMeetingToday(meeting.startIso, meeting.timeZone) ? "text-red-600 font-semibold" : ""}>
                                                        {formatMeetingDate(meeting.startIso, meeting.timeZone)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                    <FiClock className="w-3 h-3" />
                                                    {formatMeetingTimeRange(meeting.startIso, meeting.endIso, meeting.timeZone)}
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