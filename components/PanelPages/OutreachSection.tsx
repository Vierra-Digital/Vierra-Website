import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import { useSession } from "@/lib/session-client"
import { FiChevronLeft, FiChevronRight, FiTrendingUp } from "react-icons/fi"
import { m as motion } from "framer-motion"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import {
    PanelCard,
    PanelHeader,
    PanelPage,
    PanelStat,
    PanelTable,
    PanelTbody,
    PanelTd,
    PanelTh,
    PanelThead,
    PanelTr,
} from "@/components/panel/PanelTable"
import { PANEL_FIELD, PanelFieldLabel, PanelFieldSelect } from "@/components/ui/PanelForm"
import { useDraftGuard } from "@/hooks/useDraftGuard";
import { panelFetch } from "@/lib/panelFetch"

/** A titled card in the panel's shape, so every section here is bounded the same way. */
const TrackerCard: React.FC<{
    title: React.ReactNode
    children: React.ReactNode
    className?: string
}> = ({ title, children, className = "" }) => (
    <div className={className}>
        <PanelCard>
            <div className="flex items-center gap-2 border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </PanelCard>
    </div>
)

/** One labelled number entry, in the panel's field styling rather than a hand-rolled border. */
const TrackerInput: React.FC<{
    label: React.ReactNode
    value: string
    onChange: (value: string) => void
    editable: boolean
    busy: boolean
}> = ({ label, value, onChange, editable, busy }) => (
    <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]">
            {label}
        </span>
        <input
            type="text"
            className={`${PANEL_FIELD} text-right tabular-nums disabled:cursor-not-allowed disabled:opacity-60`}
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/,/g, ""))}
            placeholder="0"
            disabled={!editable || busy}
            readOnly={!editable}
        />
    </label>
)

const statFields = [
    { key: "attempts", label: "Attempts" },
    { key: "meetings", label: "Meetings" },
    { key: "clients", label: "Clients Closed" },
    { key: "revenue", label: "Revenue" }
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

type ClientStat = {
    clientId: string;
    clientName: string;
    outreach: string;
    sent: number;
    replied: number;
    replyRate: number;
    meetingsSet: number;
    clientsClosed: number;
    revenue: number;
    attemptsToMeetingsPct: number;
    meetingsToClientsPct: number;
}

type ClientManualFields = {
    meetingsSet: number;
    clientsClosed: number;
    revenue: number;
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

    // ---- Per-client analytics (System 2) --------------------------------
    const [scope, setScope] = useState<"company" | "client" | "overview">("company")
    const [clients, setClients] = useState<{ id: string; name: string }[]>([])
    /**
     * The client the funnel view is showing.
     *
     * State holds only an explicit choice; the default — the first client — is derived. An effect
     * used to write that default into state once the list loaded, which rendered the view once with
     * no client selected before correcting itself. Deriving it also handles the case the effect
     * covered awkwardly: if the selected client disappears from the list, this falls back
     * immediately rather than after another render.
     */
    const [clientChoice, setClientChoice] = useState<string>("")
    const selectedClientId = clients.some((c) => c.id === clientChoice) ? clientChoice : (clients[0]?.id ?? "")
    const [clientData, setClientData] = useState<ClientStat[]>([])
    const [clientEdits, setClientEdits] = useState<ClientManualFields>({ meetingsSet: 0, clientsClosed: 0, revenue: 0 })
    const [clientDirty, setClientDirty] = useState(false)
    const [saveError, setSaveError] = useState("");
    const [loadError, setLoadError] = useState("");
    const [savedNotice, setSavedNotice] = useState("");
    const writePending = useRef(false);
    const editVersion = useRef(0);
    useDraftGuard(hasUnsavedChanges || clientDirty, "Marketing Tracker", "5", isUpdating);
    const clientSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const calculatePercentage = useCallback((numerator: number, denominator: number) => {
        if (!denominator) return 0
        return Math.round((numerator / denominator) * 100 * 100) / 100
    }, [])

    function handleStatChange(card: CardKey, field: StatField, value: string) {
        if (!isEditable || writePending.current) return
        editVersion.current += 1
        setSaveError("")
        setSavedNotice("")
        setStats(prev => ({
            ...prev,
            [card]: {
                ...prev[card],
                [field]: field === "revenue" ? Number(value.replace(/,/g, '')) || 0 : parseInt(value.replace(/,/g, '')) || 0
            }
        }));
        setHasUnsavedChanges(true)
    }

    function handleClientStatChange(field: keyof ClientManualFields, value: string) {
        if (!isEditable || writePending.current) return
        editVersion.current += 1
        setSaveError("")
        setSavedNotice("")
        const num = field === "revenue"
            ? Number(value.replace(/,/g, '')) || 0
            : parseInt(value.replace(/,/g, '')) || 0
        setClientEdits(prev => ({ ...prev, [field]: num }))
        setClientDirty(true)
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
        if (!session?.user || !isEditable || writePending.current) return false;
        writePending.current = true;
        const version = editVersion.current;
        setSaveError("");
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
            if (version === editVersion.current) setHasUnsavedChanges(false)
            setSavedNotice("Saved");
            return true;
        } catch (error) {
            setSaveError("Could not save. Your edits are kept. Retry before changing period or client.");
            return false;
            console.error("Error updating marketing data:", error);
        } finally {
            writePending.current = false;
            setIsUpdating(false);
        }
    }, [calculatePercentage, isEditable, selectedMonth, selectedYear, session?.user, stats]);

    const fetchMonthlyData = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
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
        } catch (e) {
            // Not surfaced in the UI: this section has no error surface, and adding one is a design
            // change rather than a fix. Logging at least makes a failed load diagnosable instead of
            // silently indistinguishable from a month that genuinely has no data.
            setLoadError("Could not load this period. Retry to see current data.");
            console.error("outreach: load failed", e);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    const fetchYearlySummary = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
        try {
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
            // Fetch all 12 months in parallel (results are summed, so order is irrelevant).
            const monthlyData: StatsType[] = await Promise.all(
                Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
                    const monthStats: StatsType = {
                        NetworkingEvents: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdEmailsCartography: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
                    };
                    const response = await fetch(`/api/marketing/tracker?year=${selectedYear}&month=${month}`);
                    if (response.ok) {
                        const data = await response.json();
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
                    }
                    return monthStats;
                })
            );

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
        } catch (e) {
            // Not surfaced in the UI: this section has no error surface, and adding one is a design
            // change rather than a fix. Logging at least makes a failed load diagnosable instead of
            // silently indistinguishable from a month that genuinely has no data.
            setLoadError("Could not load this period. Retry to see current data.");
            console.error("outreach: load failed", e);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, calculatePercentage]);
    
    const fetchClientData = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await panelFetch(`/api/marketing/client-tracker?year=${selectedYear}&month=${selectedMonth}`)
            if (!response.ok) throw new Error("Failed to fetch client stats")
            const data = await response.json()
            setClients(Array.isArray(data.clients) ? data.clients : [])
            setClientData(Array.isArray(data.trackerData) ? data.trackerData : [])
            setClientDirty(false)
        } catch (e) {
            // Not surfaced in the UI: this section has no error surface, and adding one is a design
            // change rather than a fix. Logging at least makes a failed load diagnosable instead of
            // silently indistinguishable from a month that genuinely has no data.
            setLoadError("Could not load this period. Retry to see current data.");
            console.error("outreach: load failed", e);
        } finally {
            setIsLoading(false)
        }
    }, [selectedYear, selectedMonth])

    const persistClientData = useCallback(async () => {
        if (!session?.user || !isEditable || !selectedClientId || writePending.current) return false
        writePending.current = true
        const version = editVersion.current
        setSaveError("")
        setIsUpdating(true)
        try {
            const response = await panelFetch("/api/marketing/client-tracker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    year: selectedYear,
                    month: selectedMonth,
                    outreach: "linkedin",
                    meetingsSet: clientEdits.meetingsSet,
                    clientsClosed: clientEdits.clientsClosed,
                    revenue: clientEdits.revenue,
                }),
            })
            if (!response.ok) throw new Error("Failed to update client data")
            if (version === editVersion.current) setClientDirty(false)
            setSavedNotice("Saved");
            return true;
        } catch (error) {
            setSaveError("Could not save. Your edits are kept. Retry before changing period or client.");
            return false;
            console.error("Error updating client data:", error)
        } finally {
            writePending.current = false;
            setIsUpdating(false)
        }
    }, [session?.user, isEditable, selectedClientId, selectedYear, selectedMonth, clientEdits])

    useEffect(() => {
        // Each fetcher flips its own loading flag synchronously before awaiting, which is what the
        // rule sees. Refetching when the scope, period or view changes is what an effect is for.
        /* eslint-disable react-hooks/set-state-in-effect */
        if (scope === "company") {
            if (viewMode === "monthly") {
                fetchMonthlyData();
            } else {
                fetchYearlySummary();
            }
        } else {
            fetchClientData();
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [scope, selectedYear, selectedMonth, viewMode, fetchMonthlyData, fetchYearlySummary, fetchClientData]);

    // Load the selected client's manual funnel fields into the editable state.
    //
    // These genuinely are state: the user types into them. Seeding an edit buffer from freshly
    // loaded data cannot be derived, because a derived value would discard whatever had been typed
    // on the next render. The idiomatic alternative is keying a sub-component on the selection so
    // it remounts with new defaults, which would mean splitting this view apart.
    useEffect(() => {
        const row = clientData.find((c) => c.clientId === selectedClientId)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setClientEdits({
            meetingsSet: row?.meetingsSet ?? 0,
            clientsClosed: row?.clientsClosed ?? 0,
            revenue: row?.revenue ?? 0,
        })
        setClientDirty(false)
    }, [selectedClientId, clientData])

    // Debounced auto-save of the manual per-client fields.
    useEffect(() => {
        if (!clientDirty || saveError || scope !== "client" || !isEditable || isLoading) return
        if (clientSaveTimerRef.current) clearTimeout(clientSaveTimerRef.current)
        clientSaveTimerRef.current = setTimeout(() => {
            persistClientData()
        }, 400)
        return () => {
            if (clientSaveTimerRef.current) clearTimeout(clientSaveTimerRef.current)
        }
    }, [clientDirty, saveError, scope, isEditable, isLoading, persistClientData, clientEdits])

    useEffect(() => {
        if (!hasUnsavedChanges || saveError || viewMode !== "monthly" || !isEditable || isLoading) return
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
        }
        saveTimerRef.current = setTimeout(() => {
            persistMonthlyData()
        }, 250)
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [hasUnsavedChanges, saveError, isEditable, isLoading, persistMonthlyData, stats, viewMode]);

    const changeView = async (change: () => void) => {
        if (writePending.current || isLoading) return;
        if (clientSaveTimerRef.current) clearTimeout(clientSaveTimerRef.current);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (clientDirty && !(await persistClientData())) return;
        if (hasUnsavedChanges && !(await persistMonthlyData())) return;
        setSavedNotice("");
        change();
    };

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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
            >
                <TrackerCard
                    title={
                        <>
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${config.iconChip}`}>
                                <Image src={config.icon} alt="" width={14} height={14} className="h-3.5 w-3.5" />
                            </span>
                            {cardLabels[cardKey]}
                        </>
                    }
                >
                    <div className="grid grid-cols-2 gap-3">
                        {statFields.map((field) => (
                            <TrackerInput
                                key={field.key}
                                label={field.label}
                                value={getInputValue(cardStats[field.key as keyof typeof cardStats] as number)}
                                onChange={(value) => handleStatChange(cardKey, field.key as StatField, value)}
                                editable={isEditable}
                                busy={isUpdating}
                            />
                        ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#EEF1F7] pt-3 text-[12px]">
                        <span className="text-[#6B7280]">
                            Attempts to meetings{" "}
                            <span className="font-semibold text-[#701CC0]">
                                {calculatePercentage(cardStats.meetings, cardStats.attempts)}%
                            </span>
                        </span>
                        <span className="text-[#6B7280]">
                            Meetings to clients{" "}
                            <span className="font-semibold text-[#701CC0]">
                                {calculatePercentage(cardStats.clients, cardStats.meetings)}%
                            </span>
                        </span>
                    </div>
                </TrackerCard>
            </motion.div>
        )
    }

    return (
        <PanelPage>
                    <PanelHeader title="Marketing Tracker">

                            <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E4E0EC] bg-[#F3F1F8] p-1">
                                <button
                                    onClick={() => void changeView(() => setScope("company"))}
                                    className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                                        scope === "company"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    Company
                                </button>
                                <button
                                    onClick={() => void changeView(() => setScope("client"))}
                                    className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                                        scope === "client"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    By Client
                                </button>
                                <button
                                    onClick={() => void changeView(() => setScope("overview"))}
                                    className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                                        scope === "overview"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    All Clients
                                </button>
                            </div>

                            {scope === "company" && (
                            <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E4E0EC] bg-[#F3F1F8] p-1">
                                <button
                                    onClick={() => void changeView(() => setViewMode("monthly"))}
                                    className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                                        viewMode === "monthly"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => void changeView(() => setViewMode("yearly"))}
                                    className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
                                        viewMode === "yearly"
                                            ? "bg-white text-[#5B21B6] shadow-sm"
                                            : "text-[#6B7280] hover:text-[#374151]"
                                    }`}
                                >
                                    Yearly
                                </button>
                            </div>
                            )}

                            {(scope !== "company" || viewMode === "monthly") ? (
                                <>
                                    
                                    <div className="inline-flex h-9 items-center rounded-[10px] bg-[#F4F2F8] text-[#374151]">
                                        <button
                                            type="button"
                                            aria-label="Previous month"
                                            onClick={() => void changeView(() => navigateMonth("prev"))}
                                            disabled={!canNavigatePrev}
                                            className="rounded-l-[10px] p-2 transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <FiChevronLeft className="h-4 w-4" />
                                        </button>
                                        <div className="min-w-[132px] px-2 text-center text-[13px] font-medium tabular-nums">
                                            {months[selectedMonth - 1]} {selectedYear}
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Next month"
                                            onClick={() => void changeView(() => navigateMonth("next"))}
                                            disabled={!canNavigateNext}
                                            className="rounded-r-[10px] p-2 transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <FiChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>

                                    {null}
                                </>
                            ) : (
                                <div className="inline-flex h-9 items-center rounded-[10px] bg-[#F4F2F8] text-[#374151]">
                                    <button
                                        type="button"
                                        aria-label="Previous year"
                                        onClick={() => void changeView(() => setSelectedYear(selectedYear - 1))}
                                        disabled={selectedYear <= 2020}
                                        className="rounded-l-[10px] p-2 transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <FiChevronLeft className="h-4 w-4" />
                                    </button>
                                    <div className="min-w-[72px] px-2 text-center text-[13px] font-medium tabular-nums">
                                        {selectedYear}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Next year"
                                        onClick={() => void changeView(() => setSelectedYear(selectedYear + 1))}
                                        disabled={selectedYear >= currentYear}
                                        className="rounded-r-[10px] p-2 transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <FiChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                    </PanelHeader>

                    {saveError ? (
                        <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-[#B42318]">
                            {saveError}
                            <button
                                type="button"
                                onClick={() => void (scope === "client" ? persistClientData() : persistMonthlyData())}
                                className="rounded font-medium underline underline-offset-2 hover:text-[#8f1c12]"
                            >
                                Retry
                            </button>
                        </p>
                    ) : (
                        <p role="status" className="sr-only">{savedNotice}</p>
                    )}

                    {loadError ? (
                        <p role="alert" className="flex flex-wrap items-center gap-2 p-4 text-[13px] text-[#B42318]">
                            {loadError}
                            <button
                                type="button"
                                onClick={() => void (scope === "company" ? viewMode === "monthly" ? fetchMonthlyData() : fetchYearlySummary() : fetchClientData())}
                                className="rounded font-medium underline underline-offset-2 hover:text-[#8f1c12]"
                            >
                                Retry
                            </button>
                        </p>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <LoadingSpinner label="Loading Marketing Data..." />
                        </div>
                    ) : scope === "overview" ? (
                        <div className="pb-32">
                            {clientData.length === 0 ? (
                                <p className="py-12 text-center text-[13px] text-[#6B7280]">
                                    No client outreach logged for {months[selectedMonth - 1]} {selectedYear} yet.
                                </p>
                            ) : (() => {
                                const totals = clientData.reduce(
                                    (acc, c) => {
                                        acc.sent += c.sent
                                        acc.replied += c.replied
                                        acc.meetings += c.meetingsSet
                                        acc.closed += c.clientsClosed
                                        acc.revenue += c.revenue
                                        return acc
                                    },
                                    { sent: 0, replied: 0, meetings: 0, closed: 0, revenue: 0 }
                                )
                                const funnel = [
                                    { label: "Attempts", value: totals.sent, color: "#701CC0" },
                                    { label: "Replies", value: totals.replied, color: "#8F42FF" },
                                    { label: "Meetings", value: totals.meetings, color: "#A855F7" },
                                    { label: "Clients Closed", value: totals.closed, color: "#C084FC" },
                                ]
                                const maxVal = Math.max(totals.sent, 1)
                                const leaderboard = [...clientData].sort((a, b) => b.replyRate - a.replyRate || b.sent - a.sent)
                                return (
                                    <>
                                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                            <PanelStat label="Total Attempts" value={formatNumber(totals.sent)} />
                                            <PanelStat
                                                label="Total Replies"
                                                value={formatNumber(totals.replied)}
                                                hint={`${calculatePercentage(totals.replied, totals.sent)}% reply rate`}
                                            />
                                            <PanelStat label="Meetings Set" value={formatNumber(totals.meetings)} />
                                            <PanelStat label="Total Revenue" value={formatCurrency(totals.revenue)} />
                                        </div>

                                        <TrackerCard title="Conversion Funnel" className="mb-4">
                                            <div className="space-y-3">
                                                {funnel.map((stage, i) => (
                                                    <div key={stage.label}>
                                                        <div className="mb-1 flex items-center justify-between text-[12px]">
                                                            <span className="text-[#6B7280]">{stage.label}</span>
                                                            <span className="font-semibold tabular-nums text-[#111827]">
                                                                {formatNumber(stage.value)}
                                                                {i > 0 && (
                                                                    <span className="font-normal text-[#9CA3AF]">
                                                                        {" "}
                                                                        ({calculatePercentage(stage.value, funnel[i - 1].value)}% of previous)
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1EFF6]">
                                                            <div
                                                                className="h-2 rounded-full transition-all"
                                                                style={{
                                                                    width: `${Math.max((stage.value / maxVal) * 100, 2)}%`,
                                                                    background: stage.color,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TrackerCard>

                                        <TrackerCard title="Client Leaderboard">
                                            <PanelTable>
                                                <PanelThead>
                                                    <PanelTr>
                                                        <PanelTh>Client</PanelTh>
                                                        <PanelTh className="!text-right">Attempts</PanelTh>
                                                        <PanelTh className="!text-right">Replies</PanelTh>
                                                        <PanelTh className="!text-right">Reply Rate</PanelTh>
                                                        <PanelTh className="!text-right">Meetings</PanelTh>
                                                        <PanelTh className="!text-right">Closed</PanelTh>
                                                        <PanelTh className="!text-right">Revenue</PanelTh>
                                                    </PanelTr>
                                                </PanelThead>
                                                <PanelTbody>
                                                    {leaderboard.map((c) => (
                                                        <PanelTr key={c.clientId}>
                                                            <PanelTd className="font-medium text-[#111827]">{c.clientName}</PanelTd>
                                                            <PanelTd className="text-right tabular-nums">{formatNumber(c.sent)}</PanelTd>
                                                            <PanelTd className="text-right tabular-nums">{formatNumber(c.replied)}</PanelTd>
                                                            <PanelTd className="text-right font-semibold tabular-nums text-[#701CC0]">{c.replyRate}%</PanelTd>
                                                            <PanelTd className="text-right tabular-nums">{formatNumber(c.meetingsSet)}</PanelTd>
                                                            <PanelTd className="text-right tabular-nums">{formatNumber(c.clientsClosed)}</PanelTd>
                                                            <PanelTd className="text-right tabular-nums">{formatCurrency(c.revenue)}</PanelTd>
                                                        </PanelTr>
                                                    ))}
                                                </PanelTbody>
                                            </PanelTable>
                                        </TrackerCard>
                                    </>
                                )
                            })()}
                        </div>
                    ) : scope === "client" ? (
                        <div className="pb-32">
                            {clients.length === 0 ? (
                                <p className="py-12 text-center text-[13px] text-[#6B7280]">
                                    No clients yet. Add one to track outreach against it.
                                </p>
                            ) : (
                                <>
                                    <div className="mb-4 w-full sm:max-w-xs">
                                        <PanelFieldLabel>Client</PanelFieldLabel>
                                        <PanelFieldSelect
                                            value={selectedClientId}
                                            onChange={(value) => void changeView(() => setClientChoice(value))}
                                        >
                                            {clients.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </PanelFieldSelect>
                                    </div>

                                    {(() => {
                                        const sel = clientData.find((c) => c.clientId === selectedClientId)
                                        const sent = sel?.sent ?? 0
                                        const replied = sel?.replied ?? 0
                                        const replyRate = calculatePercentage(replied, sent)
                                        const manualFields: { key: keyof ClientManualFields; label: string }[] = [
                                            { key: "meetingsSet", label: "Meetings" },
                                            { key: "clientsClosed", label: "Clients Closed" },
                                            { key: "revenue", label: "Revenue" },
                                        ]
                                        return (
                                            <>
                                                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                                                    <TrackerCard
                                                        title={
                                                            <>
                                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#EEF2FF]">
                                                                    <Image src="/assets/Socials/LinkedIn.png" alt="" width={14} height={14} className="h-3.5 w-3.5" />
                                                                </span>
                                                                LinkedIn Outreach
                                                            </>
                                                        }
                                                    >
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <PanelStat label="Attempts" value={formatNumber(sent)} />
                                                            <PanelStat label="Replies" value={formatNumber(replied)} />
                                                            <PanelStat label="Reply Rate" value={`${replyRate}%`} />
                                                        </div>
                                                        <p className="mt-3 text-[11.5px] text-[#9CA3AF]">
                                                            Auto-synced from the extension.
                                                        </p>
                                                    </TrackerCard>

                                                    <TrackerCard title="Funnel" className="lg:col-span-2">
                                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                            {manualFields.map((f) => (
                                                                <TrackerInput
                                                                    key={f.key}
                                                                    label={f.label}
                                                                    value={getInputValue(clientEdits[f.key])}
                                                                    onChange={(value) => handleClientStatChange(f.key, value)}
                                                                    editable={isEditable}
                                                                    busy={isUpdating}
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#EEF1F7] pt-3 text-[12px]">
                                                            <span className="text-[#6B7280]">
                                                                Attempts to meetings{" "}
                                                                <span className="font-semibold text-[#701CC0]">
                                                                    {calculatePercentage(clientEdits.meetingsSet, sent)}%
                                                                </span>
                                                            </span>
                                                            <span className="text-[#6B7280]">
                                                                Meetings to clients{" "}
                                                                <span className="font-semibold text-[#701CC0]">
                                                                    {calculatePercentage(clientEdits.clientsClosed, clientEdits.meetingsSet)}%
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </TrackerCard>
                                                </div>

                                                <TrackerCard
                                                    title={
                                                        <>
                                                            <FiTrendingUp className="h-4 w-4 text-[#701CC0]" />
                                                            {(clients.find((c) => c.id === selectedClientId)?.name) || "Client"} — {months[selectedMonth - 1]} {selectedYear}
                                                        </>
                                                    }
                                                >
                                                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                                        <PanelStat label="Attempts" value={formatNumber(sent)} />
                                                        <PanelStat label="Reply Rate" value={`${replyRate}%`} />
                                                        <PanelStat label="Meetings" value={formatNumber(clientEdits.meetingsSet)} />
                                                        <PanelStat label="Revenue" value={formatCurrency(clientEdits.revenue)} />
                                                    </div>
                                                </TrackerCard>

                                                {!isEditable && (
                                                    <p className="text-center text-xs text-[#9CA3AF] mt-4">Past months are read-only.</p>
                                                )}
                                            </>
                                        )
                                    })()}
                                </>
                            )}
                        </div>
                    ) : viewMode === "yearly" ? (
                        <div className="pb-32">
                            {yearlySummary ? (
                                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    <PanelStat label="Total Attempts" value={formatNumber(yearlySummary.totalAttempt)} />
                                    <PanelStat label="Total Meetings" value={formatNumber(yearlySummary.totalMeetingsSet)} />
                                    <PanelStat label="Clients Closed" value={formatNumber(yearlySummary.totalClientsLosed)} />
                                    <PanelStat label="Total Revenue" value={formatCurrency(yearlySummary.totalRevenue)} />
                                </div>
                            ) : (
                                <p className="py-12 text-center text-[13px] text-[#6B7280]">
                                    Nothing recorded for {selectedYear} yet.
                                </p>
                            )}

                            {yearlySummary && (
                                <TrackerCard title={`${selectedYear} Conversion Rates`}>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-[#6B7280]">Attempts To Meetings</span>
                                                <span className="text-lg font-bold text-[#701CC0]">{yearlySummary.attemptsToMeetingsPct}%</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1EFF6]">
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
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1EFF6]">
                                                <div 
                                                    className="bg-[#701CC0] h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(yearlySummary.meetingsToClientsPct, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </TrackerCard>
                            )}
                        </div>
                    ) : (
                        <div className="pb-32">
                            {/* Totals first, then the channels that make them up — the same order
                                the dashboard reads in, and the opposite of what this page did. */}
                            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <PanelStat label="Total Attempts" value={formatNumber(summary.attempts)} />
                                <PanelStat
                                    label="Meetings Set"
                                    value={formatNumber(summary.meetings)}
                                    hint={`${calculatePercentage(summary.meetings, summary.attempts)}% of attempts`}
                                />
                                <PanelStat
                                    label="Clients Closed"
                                    value={formatNumber(summary.clients)}
                                    hint={`${calculatePercentage(summary.clients, summary.meetings)}% of meetings`}
                                />
                                <PanelStat label="Revenue" value={formatCurrency(summary.revenue)} />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {Object.keys(outreachConfig).map(key => renderOutreachCard(key as CardKey))}
                            </div>
                        </div>
                    )}
        </PanelPage>
    )
}

export default OutreachSection;
