import React, { useCallback, useState } from "react"
import { inter } from "@/lib/fonts"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { useFetch } from "@/hooks/useFetch"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
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

/**
 * Finances — the whole business, admin only.
 *
 * Reads /api/finances/overview, which sums the same `finance_entries` rows the dashboard's
 * Revenue, Expenses and Profit tiles sum, over the same month windows and with the same growth
 * rule. The two agree because they read the same source, not because the arithmetic was copied.
 */

type Month = { month: number; revenueCents: number; expenseCents: number; profitCents: number }

type Overview = {
    year: number
    /** What Stripe collected, when Stripe was reachable. Null means ledger only. */
    collected: { totalCents: number; byMonth: number[] } | null
    months: Month[]
    totals: { revenueCents: number; expenseCents: number; profitCents: number }
    currentMonth: {
        month: number
        revenueCents: number
        expenseCents: number
        profitCents: number
        revenueGrowth: number | null
        profitGrowth: number | null
    } | null
    mrrCents: number
    activeClients: number
    contracted: {
        id: string
        name: string
        retainerCents: number
        subscriptionStatus: string | null
        connected: boolean
    }[]
    entries: { id: string; kind: string; amountCents: number; occurredAt: string; note: string | null }[]
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const money = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })

const moneyExact = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })

const day = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

/** A signed percentage reads as a direction, which is the point of showing it at all. */
const growth = (value: number | null) => {
    if (value === null) return undefined
    const sign = value > 0 ? "+" : ""
    return `${sign}${value}% on last month`
}

const FinancesSection: React.FC = () => {
    const [year, setYear] = useState(() => new Date().getUTCFullYear())

    const fetcher = useCallback(async () => {
        const response = await fetch(`/api/finances/overview?year=${year}`)
        if (!response.ok) throw new Error("Failed to load")
        return (await response.json()) as Overview
    }, [year])

    const { data, loading, error, run } = useFetch<Overview>(fetcher, {
        immediate: true,
        errorMessage: "Could not load finances. Retry to see current data.",
    })

    // The tallest month sets the bar scale; profit can be negative, so the floor is its own axis.
    const peak = data ? Math.max(1, ...data.months.map((m) => Math.max(m.revenueCents, m.expenseCents))) : 1

    return (
        <div className={inter.className}>
            <PanelPage>
                <PanelHeader title="Finances">
                    <div className="inline-flex h-9 items-center rounded-[10px] border border-[#E4E0EC] bg-[#F3F1F8] text-[#374151]">
                        <button
                            type="button"
                            onClick={() => setYear((y) => y - 1)}
                            aria-label="Previous year"
                            className="rounded-l-[10px] p-2 transition-colors hover:bg-[#EAE6F3]"
                        >
                            <FiChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="min-w-[64px] px-2 text-center text-[13px] font-medium tabular-nums">{year}</div>
                        <button
                            type="button"
                            onClick={() => setYear((y) => y + 1)}
                            aria-label="Next year"
                            disabled={year >= new Date().getUTCFullYear()}
                            className="rounded-r-[10px] p-2 transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <FiChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </PanelHeader>

                {error ? (
                    <p role="alert" className="flex flex-wrap items-center justify-center gap-2 py-12 text-[13px] text-[#B42318]">
                        {error}
                        <button type="button" onClick={() => void run()} className="rounded font-medium underline underline-offset-2">
                            Retry
                        </button>
                    </p>
                ) : loading || !data ? (
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner label="Loading Finances..." />
                    </div>
                ) : (
                    <div className="pb-32">
                        <h2 className="mb-2 text-[13px] font-semibold text-[#111827]">
                            {data.currentMonth
                                ? `${MONTHS[data.currentMonth.month - 1]} ${data.year}`
                                : `${data.year} Year Summary`}
                        </h2>
                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                            <PanelStat
                                label="Revenue"
                                value={money(data.currentMonth?.revenueCents ?? data.totals.revenueCents)}
                                hint={data.currentMonth ? growth(data.currentMonth.revenueGrowth) : "This year"}
                            />
                            <PanelStat
                                label="Expenses"
                                value={money(data.currentMonth?.expenseCents ?? data.totals.expenseCents)}
                                hint={data.currentMonth ? "This month" : "This year"}
                            />
                            <PanelStat
                                label="Collected"
                                value={data.collected ? money(data.collected.totalCents) : "—"}
                                hint={data.collected ? `Paid invoices in ${data.year}` : "Stripe unavailable"}
                            />
                            <PanelStat
                                label="Profit"
                                value={money(data.currentMonth?.profitCents ?? data.totals.profitCents)}
                                hint={data.currentMonth ? growth(data.currentMonth.profitGrowth) : "This year"}
                            />
                            <PanelStat
                                label="Contracted MRR"
                                value={money(data.mrrCents)}
                                hint={`${data.activeClients} client${data.activeClients === 1 ? "" : "s"} on a retainer`}
                            />
                        </div>

                        <PanelCard className="mb-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                <h3 className="text-[13px] font-semibold text-[#111827]">{data.year} By Month</h3>
                                {/* The ledger being empty is a fact about the data, not a rendering
                                    fault, and the dashboard's tiles read the same rows — so it is
                                    said here rather than left as twelve empty bars. */}
                                {data.totals.revenueCents === 0 && data.totals.expenseCents === 0 && (
                                    <span className="text-[12px] text-[#6B7280]">
                                        No ledger entries recorded for {data.year}
                                        {data.collected && data.collected.totalCents > 0
                                            ? ` — Stripe collected ${money(data.collected.totalCents)}`
                                            : ""}
                                    </span>
                                )}
                            </div>
                            <div className="p-4">
                                <div className="space-y-2.5">
                                    {data.months.map((m) => (
                                        <div key={m.month} className="grid grid-cols-[5.5rem_minmax(0,1fr)_7rem] items-center gap-3">
                                            <span className="text-[12px] text-[#6B7280]">{MONTHS[m.month - 1]}</span>
                                            {/* Revenue over expenses on one track, so the gap between
                                                them is the profit and reads without a legend. */}
                                            <span className="relative block h-4 overflow-hidden rounded bg-[#F1EFF6]">
                                                <span
                                                    className="absolute inset-y-0 left-0 rounded bg-[#701CC0]/85"
                                                    style={{ width: `${(m.revenueCents / peak) * 100}%` }}
                                                />
                                                <span
                                                    className="absolute inset-y-[5px] left-0 rounded bg-[#B42318]/70"
                                                    style={{ width: `${(m.expenseCents / peak) * 100}%` }}
                                                />
                                            </span>
                                            <span
                                                className={`text-right text-[12.5px] font-medium tabular-nums ${
                                                    m.profitCents < 0 ? "text-[#B42318]" : "text-[#111827]"
                                                }`}
                                            >
                                                {money(m.profitCents)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#EEF1F7] pt-3 text-[12px] text-[#6B7280]">
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-sm bg-[#701CC0]/85" /> Revenue
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-sm bg-[#B42318]/70" /> Expenses
                                    </span>
                                    <span className="ml-auto tabular-nums">
                                        Year: {money(data.totals.revenueCents)} in, {money(data.totals.expenseCents)} out,{" "}
                                        <span className={data.totals.profitCents < 0 ? "text-[#B42318]" : "text-[#111827]"}>
                                            {money(data.totals.profitCents)}
                                        </span>{" "}
                                        profit
                                    </span>
                                </div>
                            </div>
                        </PanelCard>

                        <PanelCard className="mb-4">
                            <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                <h3 className="text-[13px] font-semibold text-[#111827]">Retainers</h3>
                            </div>
                            {data.contracted.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No active clients.</p>
                            ) : (
                                <PanelTable>
                                    <PanelThead>
                                        <PanelTr>
                                            <PanelTh>Client</PanelTh>
                                            <PanelTh>Subscription</PanelTh>
                                            <PanelTh className="!text-right">Monthly</PanelTh>
                                            <PanelTh className="!text-right">Share Of MRR</PanelTh>
                                        </PanelTr>
                                    </PanelThead>
                                    <PanelTbody>
                                        {data.contracted.map((c) => (
                                            <PanelTr key={c.id}>
                                                <PanelTd className="font-medium text-[#111827]">{c.name}</PanelTd>
                                                <PanelTd>
                                                    {c.subscriptionStatus ? (
                                                        <PanelBadge tone={c.subscriptionStatus === "active" ? "positive" : "warning"}>
                                                            {c.subscriptionStatus.charAt(0).toUpperCase() + c.subscriptionStatus.slice(1)}
                                                        </PanelBadge>
                                                    ) : (
                                                        <span className="text-[#9CA3AF]">Invoiced</span>
                                                    )}
                                                </PanelTd>
                                                <PanelTd className="whitespace-nowrap text-right font-medium tabular-nums">
                                                    {c.retainerCents > 0 ? moneyExact(c.retainerCents) : <span className="text-[#9CA3AF]">—</span>}
                                                </PanelTd>
                                                <PanelTd className="whitespace-nowrap text-right tabular-nums text-[#6B7280]">
                                                    {data.mrrCents > 0 && c.retainerCents > 0
                                                        ? `${Math.round((c.retainerCents / data.mrrCents) * 100)}%`
                                                        : "—"}
                                                </PanelTd>
                                            </PanelTr>
                                        ))}
                                    </PanelTbody>
                                </PanelTable>
                            )}
                        </PanelCard>

                        <PanelCard>
                            <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                <h3 className="text-[13px] font-semibold text-[#111827]">Ledger</h3>
                            </div>
                            {data.entries.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[13px] text-[#6B7280]">
                                    Nothing recorded for {data.year}.
                                </p>
                            ) : (
                                <PanelTable>
                                    <PanelThead>
                                        <PanelTr>
                                            <PanelTh>Date</PanelTh>
                                            <PanelTh>Kind</PanelTh>
                                            <PanelTh>Note</PanelTh>
                                            <PanelTh className="!text-right">Amount</PanelTh>
                                        </PanelTr>
                                    </PanelThead>
                                    <PanelTbody>
                                        {data.entries.map((e) => (
                                            <PanelTr key={e.id}>
                                                <PanelTd className="whitespace-nowrap text-[#6B7280]">{day(e.occurredAt)}</PanelTd>
                                                <PanelTd>
                                                    <PanelBadge tone={e.kind === "revenue" ? "positive" : "neutral"}>
                                                        {e.kind === "revenue" ? "Revenue" : "Expense"}
                                                    </PanelBadge>
                                                </PanelTd>
                                                <PanelTd className="text-[#6B7280]">{e.note ?? "—"}</PanelTd>
                                                <PanelTd
                                                    className={`whitespace-nowrap text-right font-medium tabular-nums ${
                                                        e.kind === "revenue" ? "text-[#111827]" : "text-[#B42318]"
                                                    }`}
                                                >
                                                    {e.kind === "revenue" ? "" : "−"}
                                                    {moneyExact(e.amountCents)}
                                                </PanelTd>
                                            </PanelTr>
                                        ))}
                                    </PanelTbody>
                                </PanelTable>
                            )}
                        </PanelCard>
                    </div>
                )}
            </PanelPage>
        </div>
    )
}

export default FinancesSection
