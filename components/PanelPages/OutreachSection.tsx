import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { FiChevronLeft, FiChevronRight, FiCalendar, FiTrendingUp, FiDollarSign, FiUsers, FiTarget } from "react-icons/fi"
import { motion } from "framer-motion"

const statFields = [
    { key: "attempts", label: "Attempts", icon: FiTarget },
    { key: "meetings", label: "Meetings", icon: FiCalendar },
    { key: "clients", label: "Clients Closed", icon: FiUsers },
    { key: "revenue", label: "Revenue", icon: FiDollarSign }
];

type CardKey =
    | "NetworkingEvents"
    | "ColdEmailsCartography"
    | "LinkedIn"
    | "Instagram"
    | "ColdCall"
    | "Other";

type StatField = "attempts" | "meetings" | "clients" | "revenue";

type StatsType = {
    [key in CardKey]: {
        attempts: number;
        meetings: number;
        clients: number;
        revenue: number;
    };
};

type YearlySummary = {
    totalAttempt: number;
    totalMeetingsSet: number;
    totalClientsLosed: number;
    totalRevenue: number;
    attemptsToMeetingsPct: number;
    meetingsToClientsPct: number;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const outreachConfig: Record<CardKey, { icon: string; iconChip: string }> = {
    NetworkingEvents: { icon: "/assets/Outreach/WalkInNetworking.png", iconChip: "bg-[#ECFDF5]" },
    ColdEmailsCartography: { icon: "/assets/Outreach/ColdMail.png", iconChip: "bg-[#F3E8FF]" },
    LinkedIn: { icon: "/assets/Socials/LinkedIn.png", iconChip: "bg-[#EEF2FF]" },
    Instagram: { icon: "/assets/Socials/Instagram.png", iconChip: "bg-[#FDF2F8]" },
    ColdCall: { icon: "/assets/Outreach/ColdCall.png", iconChip: "bg-[#F3E8FF]" },
    Other: { icon: "/assets/Outreach/Other.png", iconChip: "bg-[#F9FAFB]" }
};

const cardLabels: Record<CardKey, string> = {
    NetworkingEvents: "Networking Events",
    ColdEmailsCartography: "Cold Emails & Cartography",
    LinkedIn: "LinkedIn",
    Instagram: "Instagram",
    ColdCall: "Cold Call",
    Other: "Other",
};

const OutreachSection = () => {
    const { data: session } = useSession()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly")
    const [yearlySummary, setYearlySummary] = useState<YearlySummary | null>(null)

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const [selectedYear, setSelectedYear] = useState(currentYear)
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)

    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    const isFutureDate = selectedYear > currentYear || (selectedYear === currentYear && selectedMonth > currentMonth)
    const isEditable = isCurrentMonth && !isFutureDate

    const [stats, setStats] = useState<StatsType>({
        NetworkingEvents: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdEmailsCartography: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    });

    const calculatePercentage = useCallback((numerator: number, denominator: number) => {
        if (!denominator) return 0
        return Math.round((numerator / denominator) * 100 * 100) / 100
    }, [])

    function handleStatChange(card: CardKey, field: StatField, value: string) {
        if (!isEditable) return
        setStats(prev => ({
            ...prev,
            [card]: {
                ...prev[card],
                [field]: field === "revenue" ? Number(value.replace(/,/g, '')) || 0 : parseInt(value.replace(/,/g, '')) || 0
            }
        }));
        setHasUnsavedChanges(true)
    }

    function getInputValue(val: number) {
        return val === 0 ? "" : val.toLocaleString();
    }

    function formatNumber(num: number) {
        return num.toLocaleString();
    }

    function formatCurrency(num: number) {
        return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const summary = useMemo(() => Object.values(stats).reduce(
        (acc, curr) => {
            acc.attempts += curr.attempts;
            acc.meetings += curr.meetings;
            acc.clients += curr.clients;
            acc.revenue += curr.revenue;
            return acc;
        },
        { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    ), [stats]);

    const persistMonthlyData = useCallback(async () => {
        if (!session?.user || !isEditable) return;
        setIsUpdating(true);
        try {
            const outreachMap: Record<CardKey, string> = {
                NetworkingEvents: "walkinnetworking",
                ColdEmailsCartography: "coldmail",
                LinkedIn: "linkedin",
                Instagram: "instagram", 
                ColdCall: "coldcall",
                Other: "other"
            };
            const trackerData = Object.entries(stats).map(([cardKey, data]) => ({
                outreach: outreachMap[cardKey as CardKey],
                attempt: data.attempts,
                meetingsSet: data.meetings,
                clientsClosed: data.clients,
                revenue: data.revenue,
                attemptsToMeetingsPct: calculatePercentage(data.meetings, data.attempts),
                meetingsToClientsPct: calculatePercentage(data.clients, data.meetings)
            }));
            const response = await fetch("/api/marketing/tracker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: selectedYear,
                    month: selectedMonth,
                    trackerData
                })
            });
            if (!response.ok) {
                throw new Error("Failed to update marketing data");
            }
            setHasUnsavedChanges(false)
        } catch (error) {
            console.error("Error updating marketing data:", error);
        } finally {
            setIsUpdating(false);
        }
    }, [calculatePercentage, isEditable, selectedMonth, selectedYear, session?.user, stats]);

    const fetchMonthlyData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/marketing/tracker?year=${selectedYear}&month=${selectedMonth}`);
            if (!response.ok) throw new Error("Failed to fetch stats");
            const data = await response.json();
            const outreachMap: Record<string, CardKey> = {
                walkinnetworking: "NetworkingEvents",
                coldmail: "ColdEmailsCartography",
                emailingplatform: "ColdEmailsCartography",
                linkedin: "LinkedIn",
                instagram: "Instagram",
                coldcall: "ColdCall",
                facebook: "Other",
                googleads: "Other",
                coldmessage: "Other",
                autoresponder: "Other",
                other: "Other",
            };
            const newStats: StatsType = {
                NetworkingEvents: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                ColdEmailsCartography: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
            };
            if (Array.isArray(data.trackerData)) {
                data.trackerData.forEach((item: any) => {
                    const key = outreachMap[item.outreach];
                    if (key) {
                        newStats[key] = {
                            attempts: newStats[key].attempts + (item.attempt ?? 0),
                            meetings: newStats[key].meetings + (item.meetingsSet ?? 0),
                            clients: newStats[key].clients + (item.clientsClosed ?? 0),
                            revenue: newStats[key].revenue + (item.revenue ?? 0),
                        };
                    }
                });
            }
            setStats(newStats);
            setHasUnsavedChanges(false)
        } catch {
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    const fetchYearlySummary = useCallback(async () => {
        setIsLoading(true);
        try {
            const monthlyData: StatsType[] = []
            for (let month = 1; month <= 12; month++) {
                const response = await fetch(`/api/marketing/tracker?year=${selectedYear}&month=${month}`);
                if (response.ok) {
                    const data = await response.json();
                    const outreachMap: Record<string, CardKey> = {
                        walkinnetworking: "NetworkingEvents",
                        coldmail: "ColdEmailsCartography",
                        emailingplatform: "ColdEmailsCartography",
                        linkedin: "LinkedIn",
                        instagram: "Instagram",
                        coldcall: "ColdCall",
                        facebook: "Other",
                        googleads: "Other",
                        coldmessage: "Other",
                        autoresponder: "Other",
                        other: "Other",
                    };
                    const monthStats: StatsType = {
                        NetworkingEvents: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdEmailsCartography: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
                    };
                    if (Array.isArray(data.trackerData)) {
                        data.trackerData.forEach((item: any) => {
                            const key = outreachMap[item.outreach];
                            if (key) {
                                monthStats[key] = {
                                    attempts: monthStats[key].attempts + (item.attempt ?? 0),
                                    meetings: monthStats[key].meetings + (item.meetingsSet ?? 0),
                                    clients: monthStats[key].clients + (item.clientsClosed ?? 0),
                                    revenue: monthStats[key].revenue + (item.revenue ?? 0),
                                };
                            }
                        });
                    }
                    monthlyData.push(monthStats)
                }
            }
            
            const yearly = monthlyData.reduce((acc, month) => {
                Object.values(month).forEach(channel => {
                    acc.totalAttempt += channel.attempts
                    acc.totalMeetingsSet += channel.meetings
                    acc.totalClientsLosed += channel.clients
                    acc.totalRevenue += channel.revenue
                })
                return acc
            }, { totalAttempt: 0, totalMeetingsSet: 0, totalClientsLosed: 0, totalRevenue: 0 })

            setYearlySummary({
                ...yearly,
                attemptsToMeetingsPct: calculatePercentage(yearly.totalMeetingsSet, yearly.totalAttempt),
                meetingsToClientsPct: calculatePercentage(yearly.totalClientsLosed, yearly.totalMeetingsSet)
            })
        } catch {
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, calculatePercentage]);
    
    useEffect(() => {
        if (viewMode === "monthly") {
            fetchMonthlyData();
        } else {
            fetchYearlySummary();
        }
    }, [selectedYear, selectedMonth, viewMode, fetchMonthlyData, fetchYearlySummary]);

    useEffect(() => {
        if (!hasUnsavedChanges || viewMode !== "monthly" || !isEditable || isLoading) return
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = setTimeout(() => {
            persistMonthlyData()
        }, 250)
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [hasUnsavedChanges, isEditable, isLoading, persistMonthlyData, stats, viewMode]);

    const navigateMonth = (direction: "prev" | "next") => {
        if (direction === "prev") {
            if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    const canNavigatePrev = selectedYear > 2020 || (selectedYear === 2020 && selectedMonth > 1)
    const canNavigateNext = !isFutureDate && (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth))

    const renderOutreachCard = (cardKey: CardKey) => {
        const config = outreachConfig[cardKey]
        const cardStats = stats[cardKey]
        
        return (
            <motion.div
                key={cardKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-sm border border-[#E8EBF4] overflow-hidden hover:shadow-md hover:border-[#D9CCF8] transition-all"
            >
                <div className="px-4 py-3 border-b border-[#EEF1F7] bg-[#FBFCFF]">
                    <h3 className="font-semibold text-[#111827] flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${config.iconChip}`}>
                            <Image src={config.icon} alt={cardKey} width={16} height={16} className="w-4 h-4" />
                        </span>
                        {cardLabels[cardKey]}
                    </h3>
                </div>
                <div className="p-5">
                    <div className="space-y-4">
                        {statFields.map(field => {
                            const Icon = field.icon
                            return (
                                <div key={field.key} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-[#6B7280]" />
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                    </div>
                                    <input
                                        type="text"
                                        className={`text-sm font-semibold text-[#111827] w-28 rounded-md border px-2 py-1 bg-white ${
                                            isEditable ? "border-[#D7DDED] focus:border-[#701CC0] focus:ring-1 focus:ring-[#701CC0]" : "border-[#E5E7EB]"
                                        } focus:outline-none text-right transition-colors ${!isEditable ? 'cursor-not-allowed opacity-60' : ''}`}
                                        value={getInputValue(cardStats[field.key as keyof typeof cardStats] as number)}
                                        onChange={e => {
                                            const value = e.target.value.replace(/,/g, '');
                                            handleStatChange(cardKey, field.key as StatField, value);
                                        }}
                                        placeholder="0"
                                        disabled={!isEditable || isUpdating}
                                        readOnly={!isEditable}
                                    />
                                </div>
                            )
                        })}
                        <div className="pt-3 border-t border-gray-200 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#6B7280]">Attempts To Meetings</span>
                                <span className="text-sm font-semibold text-[#701CC0]">
                                    {calculatePercentage(cardStats.meetings, cardStats.attempts)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#6B7280]">Meetings To Clients</span>
                                <span className="text-sm font-semibold text-[#701CC0]">
                                    {calculatePercentage(cardStats.clients, cardStats.meetings)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )
    }

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col overflow-auto">
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="w-full max-w-6xl flex flex-col h-full">
                    
                    <div className="w-full flex justify-between items-center mb-2">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">Marketing Tracker</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            
                            <div className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-[#F3F1F8] p-1">
                                <button
                                    onClick={() => setViewMode("monthly")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        viewMode === "monthly"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setViewMode("yearly")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                        viewMode === "yearly"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    Yearly
                                </button>
                            </div>

                            {viewMode === "monthly" ? (
                                <>
                                    
                                    <div className="flex items-center gap-2 bg-gradient-to-r from-[#5B1A96] to-[#701CC0] rounded-lg border border-[#4C1580] shadow-md">
                                        <button
                                            onClick={() => navigateMonth("prev")}
                                            disabled={!canNavigatePrev}
                                            className="p-2 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                                        >
                                            <FiChevronLeft className="w-4 h-4 text-white" />
                                        </button>
                                        <div className="px-4 py-2 text-sm font-semibold text-white min-w-[140px] text-center tracking-wide">
                                            {months[selectedMonth - 1]} {selectedYear}
                                        </div>
                                        <button
                                            onClick={() => navigateMonth("next")}
                                            disabled={!canNavigateNext}
                                            className="p-2 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                                        >
                                            <FiChevronRight className="w-4 h-4 text-white" />
                                        </button>
                                    </div>

                                    {null}
                                </>
                            ) : (
                                <div className="flex items-center gap-2 bg-gradient-to-r from-[#5B1A96] to-[#701CC0] rounded-lg border border-[#4C1580] shadow-md">
                                    <button
                                        onClick={() => setSelectedYear(selectedYear - 1)}
                                        disabled={selectedYear <= 2020}
                                        className="p-2 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                                    >
                                        <FiChevronLeft className="w-4 h-4 text-white" />
                                    </button>
                                    <div className="px-4 py-2 text-sm font-semibold text-white min-w-[100px] text-center tracking-wide">
                                        {selectedYear}
                                    </div>
                                    <button
                                        onClick={() => setSelectedYear(selectedYear + 1)}
                                        disabled={selectedYear >= currentYear}
                                        className="p-2 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                                    >
                                        <FiChevronRight className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto"></div>
                                <p className="mt-2 text-sm text-[#6B7280]">Loading Marketing Data...</p>
                            </div>
                        </div>
                    ) : viewMode === "yearly" ? (
                        <div className="pb-32">
                            <div className="bg-gradient-to-br from-[#701CC0] to-[#5f17a5] rounded-xl shadow-lg p-8 mb-6 text-white">
                                <h2 className="text-2xl font-bold mb-2">{selectedYear} Year Summary</h2>
                                <p className="text-white/80 text-sm">A complete overview to all marketing outreach methods and analytics.</p>
                            </div>

                            {yearlySummary ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <FiTarget className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Attempts</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalAttempt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <FiCalendar className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Meetings</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalMeetingsSet)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <FiUsers className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Clients Closed</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatNumber(yearlySummary.totalClientsLosed)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-yellow-100 rounded-lg">
                                                <FiDollarSign className="w-5 h-5 text-yellow-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[#6B7280]">Total Revenue</p>
                                                <p className="text-2xl font-bold text-[#111827]">{formatCurrency(yearlySummary.totalRevenue)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">No data available for {selectedYear}</div>
                            )}

                            {yearlySummary && (
                                <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6">
                                    <h3 className="text-lg font-semibold text-[#111827] mb-4">Conversion Rates</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-[#6B7280]">Attempts To Meetings</span>
                                                <span className="text-lg font-bold text-[#701CC0]">{yearlySummary.attemptsToMeetingsPct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-[#701CC0] h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(yearlySummary.attemptsToMeetingsPct, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-[#6B7280]">Meetings To Clients</span>
                                                <span className="text-lg font-bold text-[#701CC0]">{yearlySummary.meetingsToClientsPct}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-[#701CC0] h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(yearlySummary.meetingsToClientsPct, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="pb-32">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {Object.keys(outreachConfig).map(key => renderOutreachCard(key as CardKey))}
                            </div>

                            
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                                className="bg-gradient-to-br from-[#701CC0] to-[#5f17a5] rounded-xl shadow-lg p-8 text-white"
                            >
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <FiTrendingUp className="w-5 h-5" />
                                    Monthly Summary - {months[selectedMonth - 1]} {selectedYear}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Total Attempts</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.attempts)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Meetings Set</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.meetings)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Clients Closed</p>
                                        <p className="text-3xl font-bold">{formatNumber(summary.clients)}</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Revenue</p>
                                        <p className="text-3xl font-bold">{formatCurrency(summary.revenue)}</p>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/20 grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Attempts To Meetings</p>
                                        <p className="text-2xl font-bold">{calculatePercentage(summary.meetings, summary.attempts)}%</p>
                                    </div>
                                    <div>
                                        <p className="text-white/80 text-sm mb-1">Meetings To Clients</p>
                                        <p className="text-2xl font-bold">{calculatePercentage(summary.clients, summary.meetings)}%</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default OutreachSection;
