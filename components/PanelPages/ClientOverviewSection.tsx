import React, { useCallback } from "react"
import { inter } from "@/lib/fonts"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { useFetch } from "@/hooks/useFetch"
import {
    PanelBadge,
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

type CampaignRow = {
    id: string
    name: string
    status: string
    contacts: number
    steps: number
    createdAt: string
    startedAt: string | null
    completedAt: string | null
}

type Overview = {
    analytics: { campaigns: number; activeCampaigns: number; leads: number; billedCents: number }
    campaigns: CampaignRow[]
}

export type ClientOverviewView = "analytics" | "campaigns"

const VIEW_TITLES: Record<ClientOverviewView, string> = {
    analytics: "Analytics",
    campaigns: "Campaign History",
}

const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })

const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null

/** Campaign statuses carry their own meaning; only the finished and stopped ones need colour. */
const statusTone = (status: string): "positive" | "warning" | "info" | "neutral" =>
    status === "completed"
        ? "positive"
        : status === "active" || status === "running"
          ? "info"
          : status === "paused" || status === "draft"
            ? "warning"
            : "neutral"

type ClientOverviewSectionProps = {
    /** Which of the three this instance is. Each is its own sidebar destination. */
    view: ClientOverviewView
    /**
     * The client company to read. Omitted by the client's own page, where the session already
     * says which company it is; supplied by staff opening a client workspace, who could be
     * looking at any of them.
     */
    companyId?: string | null
    title?: string
}

/**
 * What a client sees about their own account, and what staff see when they open that client.
 *
 * One component for both so the two cannot drift into showing different things — the client's own
 * page previously had a "Dashboard" heading with nothing underneath it at all.
 */
const ClientOverviewSection: React.FC<ClientOverviewSectionProps> = ({ view, companyId = null, title }) => {

    const fetcher = useCallback(async () => {
        // A representative's own company comes from their session, so the parameter is only sent
        // when staff are looking at someone else's.
        const url = companyId
            ? `/api/client/overview?companyId=${encodeURIComponent(companyId)}`
            : "/api/client/overview"
        const response = await fetch(url)
        if (!response.ok) throw new Error("Failed to load")
        return (await response.json()) as Overview
    }, [companyId])

    const { data, loading, error, run: load } = useFetch<Overview>(fetcher, {
        immediate: true,
        errorMessage: "Could not load this account. Retry to see current data.",
    })

    return (
        <div className={inter.className}>
            <PanelPage>
                <PanelHeader title={title ?? VIEW_TITLES[view]} />

                {error ? (
                    <p role="alert" className="flex flex-wrap items-center gap-2 py-12 text-center text-[13px] text-[#B42318]">
                        {error}
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="rounded font-medium underline underline-offset-2 hover:text-[#8f1c12]"
                        >
                            Retry
                        </button>
                    </p>
                ) : loading || !data ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner label="Loading Account Data..." />
                    </div>
                ) : view === "analytics" ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <PanelStat label="Campaigns" value={data.analytics.campaigns} />
                        <PanelStat
                            label="Active Campaigns"
                            value={data.analytics.activeCampaigns}
                            hint={data.analytics.activeCampaigns === 0 ? "None running" : "Currently sending"}
                        />
                        <PanelStat label="Leads Generated" value={data.analytics.leads} />
                        <PanelStat label="Billed To Date" value={formatCurrency(data.analytics.billedCents)} />
                    </div>
                ) : view === "campaigns" ? (
                    data.campaigns.length === 0 ? (
                        <p className="py-12 text-center text-[13px] text-[#6B7280]">No campaigns have run yet.</p>
                    ) : (
                        <PanelCard>
                            <PanelTable>
                                <PanelThead>
                                    <PanelTr>
                                        <PanelTh>Campaign</PanelTh>
                                        <PanelTh>Status</PanelTh>
                                        <PanelTh className="!text-right">Contacts</PanelTh>
                                        <PanelTh className="!text-right">Steps</PanelTh>
                                        <PanelTh>Started</PanelTh>
                                        <PanelTh>Completed</PanelTh>
                                    </PanelTr>
                                </PanelThead>
                                <PanelTbody>
                                    {data.campaigns.map((campaign) => (
                                        <PanelTr key={campaign.id}>
                                            <PanelTd className="font-medium text-[#111827]">{campaign.name}</PanelTd>
                                            <PanelTd>
                                                <PanelBadge tone={statusTone(campaign.status)}>{campaign.status}</PanelBadge>
                                            </PanelTd>
                                            <PanelTd className="text-right tabular-nums">{campaign.contacts}</PanelTd>
                                            <PanelTd className="text-right tabular-nums">{campaign.steps}</PanelTd>
                                            <PanelTd className="text-[#6B7280]">
                                                {formatDate(campaign.startedAt) ?? "Not started"}
                                            </PanelTd>
                                            <PanelTd className="text-[#6B7280]">
                                                {formatDate(campaign.completedAt) ?? "—"}
                                            </PanelTd>
                                        </PanelTr>
                                    ))}
                                </PanelTbody>
                            </PanelTable>
                        </PanelCard>
                    )
                ) : null}
            </PanelPage>
        </div>
    )
}

export default ClientOverviewSection
