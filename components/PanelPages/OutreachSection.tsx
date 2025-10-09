import React, { useState, useEffect } from "react"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useSession } from "next-auth/react"
const inter = Inter({ subsets: ["latin"] })

const statFields = [
    { key: "attempts", label: "Attempts" },
    { key: "meetings", label: "Meetings Set" },
    { key: "clients", label: "Clients Closed" },
    { key: "revenue", label: "revenue($)" }
];

type CardKey =
    | "LinkedIn"
    | "Instagram"
    | "Facebook"
    | "ColdCall"
    | "ColdMail"
    | "ColdMessage"
    | "WalkInNetworking"
    | "AutoResponder"
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

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const OutreachSection = () => {
    const { data: session } = useSession()
    const [isUpdating, setIsUpdating] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const [stats, setStats] = useState<StatsType>({
        LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Facebook: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdMail: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        ColdMessage: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        WalkInNetworking: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        AutoResponder: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
        Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    });

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return months[now.getMonth()];
    });

    const now = new Date();
    const currentMonth = months[now.getMonth()];
    const isCurrentMonth = selectedMonth === currentMonth;

    function getPercent(numerator: number, denominator: number) {
        if (!denominator) return "0%";
        return `${Math.round(((numerator + denominator)/2) * 100).toLocaleString()}%`;
    }

    function handleStatChange(card: CardKey, field: StatField, value: string) {
        setStats(prev => ({
            ...prev,
            [card]: {
                ...prev[card],
                [field]: field === "revenue" ? Number(value) : parseInt(value) || 0
            }
        }));
    }

    function getInputValue(val: number) {
        return val === 0 ? "" : val.toLocaleString();
    }

    function formatNumber(num: number) {
        return num.toLocaleString();
    }

    function formatCurrency(num: number) {
        return `$${num.toLocaleString()}`;
    }

    const summary = Object.values(stats).reduce(
        (acc, curr) => {
            acc.attempts += curr.attempts;
            acc.meetings += curr.meetings;
            acc.clients += curr.clients;
            acc.revenue += curr.revenue;
            return acc;
        },
        { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
    );

    const handleUpdate = async () => {
        if (!session?.user) return;
        setIsUpdating(true);
        try {
            const year = now.getFullYear();
            const month = months.indexOf(selectedMonth) + 1;
            const outreachMap: Record<CardKey, string> = {
                LinkedIn: "linkedin",
                Instagram: "instagram", 
                Facebook: "facebook",
                ColdCall: "coldcall",
                ColdMail: "coldmail",
                ColdMessage: "coldmessage",
                WalkInNetworking: "walkinnetworking",
                AutoResponder: "autoresponder",
                Other: "other"
            };
            const trackerData = Object.entries(stats).map(([cardKey, data]) => ({
                outreach: outreachMap[cardKey as CardKey],
                attempt: data.attempts,
                meetingsSet: data.meetings,
                clientsClosed: data.clients,
                revenue: data.revenue,
                attemptsToMeetingsPct: data.attempts ? ((data.meetings + data.attempts)/2) * 100 : 0,
                meetingsToClientsPct: data.meetings ? ((data.clients + data.meetings)/2) * 100 : 0
            }));
            const response = await fetch("/api/marketing/tracker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year,
                    month,
                    trackerData
                })
            });
            if (!response.ok) {
                throw new Error("Failed to update marketing data");
            }
            alert("Marketing data updated successfully!");
        } catch (error) {
            console.error("Error updating marketing data:", error);
            alert("Failed to update marketing data. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };
    
    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const year = now.getFullYear();
                const month = months.indexOf(selectedMonth) + 1;
                const response = await fetch(`/api/marketing/tracker?year=${year}&month=${month}`);
                if (!response.ok) throw new Error("Failed to fetch stats");
                const data = await response.json();
                // Map backend data to StatsType
                const outreachMap: Record<string, CardKey> = {
                    linkedin: "LinkedIn",
                    instagram: "Instagram",
                    facebook: "Facebook",
                    coldcall: "ColdCall",
                    coldmail: "ColdMail",
                    coldmessage: "ColdMessage",
                    walkinnetworking: "WalkInNetworking",
                    autoresponder: "AutoResponder",
                    other: "Other"
                };
                const newStats: StatsType = {
                    LinkedIn: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    Instagram: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    Facebook: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    ColdCall: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    ColdMail: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    ColdMessage: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    WalkInNetworking: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    AutoResponder: { attempts: 0, meetings: 0, clients: 0, revenue: 0 },
                    Other: { attempts: 0, meetings: 0, clients: 0, revenue: 0 }
                };
                if (Array.isArray(data.trackerData)) {
                    data.trackerData.forEach((item: any) => {
                        const key = outreachMap[item.outreach];
                        if (key) {
                            newStats[key] = {
                                attempts: item.attempt ?? 0,
                                meetings: item.meetingsSet ?? 0,
                                clients: item.clientsClosed ?? 0,
                                revenue: item.revenue ?? 0
                            };
                        }
                    });
                }
                setStats(newStats);
            } catch {
                // Optional
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [selectedMonth]);

    return (
        <div className="w-full h-full bg-[#F8F0FF] p-8 overflow-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-semibold text-[#111827]">Dashboard</h1>
                    <div className="flex items-center gap-3">
                        <button
                            className={`px-4 py-2 rounded-lg font-semibold text-white bg-[#701CC0] hover:bg-[#8F42FF] cursor-pointer ${!isCurrentMonth ? "bg-gray-300 text-gray-400 cursor-not-allowed" : ""}`}
                            disabled={!isCurrentMonth || isUpdating}
                            onClick={handleUpdate}
                        >
                            {isUpdating ? "Updating..." : "Update"}
                        </button>
                        <select
                            className="border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm bg-white text-black"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                        >
                            {months.map(month => (
                                <option key={month}>{month}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {isLoading ? (
                    <div className="text-center py-8 text-lg text-gray-500">Loading data...</div>
                ) : (
                <>
                {/* Social Media Platforms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* LinkedIn */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/LinkedIn.png" alt="LinkedIn" width={20} height={20} className="w-5 h-5" />
                                LinkedIn
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.LinkedIn[field.key as keyof typeof stats.LinkedIn] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("LinkedIn", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.LinkedIn.meetings, stats.LinkedIn.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.LinkedIn.clients, stats.LinkedIn.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Instagram */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/Instagram.png" alt="Instagram" width={20} height={20} className="w-5 h-5" />
                                Instagram
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.Instagram[field.key as keyof typeof stats.Instagram] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("Instagram", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Instagram.meetings, stats.Instagram.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Instagram.clients, stats.Instagram.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Facebook */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/Facebook.png" alt="Facebook" width={20} height={20} className="w-5 h-5" />
                                Facebook
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.Facebook[field.key as keyof typeof stats.Facebook] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("Facebook", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Facebook.meetings, stats.Facebook.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Facebook.clients, stats.Facebook.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Additional Outreach Methods */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Cold Call */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdCall.png" alt="Cold Call" width={20} height={20} className="w-5 h-5" />
                                Cold Call
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.ColdCall[field.key as keyof typeof stats.ColdCall] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("ColdCall", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdCall.meetings, stats.ColdCall.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdCall.clients, stats.ColdCall.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold Mail */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdMail.png" alt="Cold Mail" width={20} height={20} className="w-5 h-5" />
                                Cold Mail
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.ColdMail[field.key as keyof typeof stats.ColdMail] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("ColdMail", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdMail.meetings, stats.ColdMail.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdMail.clients, stats.ColdMail.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold Messaging */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdMessage.png" alt="Cold Messaging" width={20} height={20} className="w-5 h-5" />
                                Cold Messaging
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.ColdMessage[field.key as keyof typeof stats.ColdMessage] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("ColdMessage", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdMessage.meetings, stats.ColdMessage.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.ColdMessage.clients, stats.ColdMessage.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Final Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Walk In Networking */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/WalkInNetworking.png" alt="Walk In Networking" width={20} height={20} className="w-5 h-5" />
                                Walk In Networking
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.WalkInNetworking[field.key as keyof typeof stats.WalkInNetworking] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("WalkInNetworking", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.WalkInNetworking.meetings, stats.WalkInNetworking.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.WalkInNetworking.clients, stats.WalkInNetworking.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Auto Responder */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/AutoResponder.png" alt="Auto Responder" width={20} height={20} className="w-5 h-5" />
                                Auto Responder
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.AutoResponder[field.key as keyof typeof stats.AutoResponder] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("AutoResponder", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.AutoResponder.meetings, stats.AutoResponder.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.AutoResponder.clients, stats.AutoResponder.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold (Other) */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/Other.png" alt="Cold (Other)" width={20} height={20} className="w-5 h-5" />
                                Cold (Other)
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                {statFields.map(field => (
                                    <div className="flex justify-between" key={field.key}>
                                        <span className="text-sm text-[#6B7280]">{field.label}</span>
                                        <input
                                            type="text"
                                            className={`text-sm font-bold text-black ${inter.className} w-16 bg-transparent border-b border-gray-200 focus:outline-none text-right placeholder-black`}
                                            value={getInputValue(stats.Other[field.key as keyof typeof stats.Other] as number)}
                                            onChange={e => {
                                                const value = e.target.value.replace(/,/g, '');
                                                handleStatChange("Other", field.key as StatField, value);
                                            }}
                                            placeholder="0"
                                            disabled={!isCurrentMonth || isUpdating}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Other.meetings, stats.Other.attempts)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>
                                        {getPercent(stats.Other.clients, stats.Other.meetings)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Summary Section */}
                <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                    <div className="bg-[#3B82F6] text-white text-center py-3">
                        <h3 className="font-medium">SUMMARY</h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Attempts</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>{formatNumber(summary.attempts)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>{formatNumber(summary.meetings)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>{formatNumber(summary.clients)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">revenue($)</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>{formatCurrency(summary.revenue)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>
                                    {getPercent(summary.meetings, summary.attempts)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>
                                    {getPercent(summary.clients, summary.meetings)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                </>
                )}
            </div>
        </div>
    )
}
export default OutreachSection;