import React, { useCallback, useState } from "react"
import { inter } from "@/lib/fonts"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { useFetch } from "@/hooks/useFetch"
import { FiDownload, FiExternalLink } from "react-icons/fi"
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

type PaymentMethod = {
    id: string
    type: string
    brand: string | null
    last4: string | null
    bankName: string | null
    expMonth: number | null
    expYear: number | null
    isDefault: boolean
}

type Invoice = {
    id: string
    number: string | null
    status: string | null
    totalCents: number
    amountPaidCents: number
    amountDueCents: number
    currency: string
    created: string
    dueDate: string | null
    pdfUrl: string | null
    hostedUrl: string | null
    description: string | null
}

type Payment = {
    id: string
    status: string
    amountCents: number
    refundedCents: number
    currency: string
    created: string
    description: string | null
    receiptUrl: string | null
    failureMessage: string | null
    brand: string | null
    last4: string | null
}

type Billing = {
    connected: boolean
    clientName?: string | null
    retainerCents: number | null
    paymentMethods: PaymentMethod[]
    subscription: {
        id: string
        status: string
        cancelAtPeriodEnd: boolean
        currentPeriodEnd: string | null
        amountCents: number | null
        interval: string | null
    } | null
    invoices: Invoice[]
    payments: Payment[]
}

const money = (cents: number, currency = "usd") =>
    (cents / 100).toLocaleString(undefined, {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 2,
    })

const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"

const INVOICE_TONES: Record<string, "positive" | "warning" | "danger" | "neutral"> = {
    paid: "positive",
    open: "warning",
    draft: "neutral",
    uncollectible: "danger",
    void: "neutral",
}

const PAYMENT_TONES: Record<string, "positive" | "warning" | "danger"> = {
    succeeded: "positive",
    pending: "warning",
    failed: "danger",
}

/** "visa" reads as "Visa"; a bank account says which bank rather than which brand. */
const describeMethod = (method: PaymentMethod) => {
    if (method.type === "card") {
        const brand = method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"
        return `${brand} ending ${method.last4 ?? "••••"}`
    }
    if (method.type === "us_bank_account") {
        return `${method.bankName ?? "Bank account"} ending ${method.last4 ?? "••••"}`
    }
    return method.type.replace(/_/g, " ")
}

type ClientBillingSectionProps = {
    /** Supplied by staff viewing a client; a representative's own company comes from the session. */
    companyId?: string | null
    /** Representatives can open the Stripe portal; staff read only. */
    canManage?: boolean
}

const ClientBillingSection: React.FC<ClientBillingSectionProps> = ({ companyId = null, canManage = false }) => {
    const [openingPortal, setOpeningPortal] = useState(false)
    const [portalError, setPortalError] = useState("")
    const [renewalBusy, setRenewalBusy] = useState(false)

    const fetcher = useCallback(async () => {
        const url = companyId
            ? `/api/client/billing?companyId=${encodeURIComponent(companyId)}`
            : "/api/client/billing"
        const response = await fetch(url)
        if (!response.ok) throw new Error("Failed to load")
        return (await response.json()) as Billing
    }, [companyId])

    const { data, loading, error, run } = useFetch<Billing>(fetcher, {
        immediate: true,
        errorMessage: "Could not load billing. Retry to see current data.",
    })

    const openPortal = async () => {
        setOpeningPortal(true)
        setPortalError("")
        try {
            const response = await fetch("/api/client/billing-portal", { method: "POST" })
            const body = await response.json().catch(() => ({}))
            if (!response.ok || !body?.url) throw new Error(body?.message || "Could not open the billing portal.")
            window.location.href = body.url as string
        } catch (e) {
            setPortalError(e instanceof Error ? e.message : "Could not open the billing portal.")
            setOpeningPortal(false)
        }
    }

    const setAutoRenew = async (autoRenew: boolean) => {
        setRenewalBusy(true)
        setPortalError("")
        try {
            const response = await fetch("/api/client/billing-subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ autoRenew }),
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(body?.message || "Could not update renewal.")
            await run()
        } catch (e) {
            setPortalError(e instanceof Error ? e.message : "Could not update renewal.")
        } finally {
            setRenewalBusy(false)
        }
    }

    // Drafts carry no amount anyone owes yet, and a void invoice is not owed either — counting
    // either as outstanding overstates the balance.
    const paidTotal = data ? data.invoices.reduce((sum, i) => sum + i.amountPaidCents, 0) : 0
    const outstanding = data
        ? data.invoices
              .filter((i) => i.status === "open" || i.status === "uncollectible")
              .reduce((sum, i) => sum + i.amountDueCents, 0)
        : 0
    const openInvoices = data ? data.invoices.filter((i) => i.status === "open").length : 0

    return (
        <div className={inter.className}>
            <PanelPage>
                <PanelHeader title="Billing">
                    {canManage && data?.connected && (
                        <button
                            type="button"
                            onClick={() => void openPortal()}
                            disabled={openingPortal}
                            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiExternalLink className="h-4 w-4" />
                            {openingPortal ? "Opening…" : "Manage Payment"}
                        </button>
                    )}
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
                        <LoadingSpinner label="Loading Billing..." />
                    </div>
                ) : !data.connected ? (
                    <p className="py-12 text-center text-[13px] text-[#6B7280]">
                        No billing account yet. One is created when the first payment method is added.
                    </p>
                ) : (
                    <>
                        {portalError && <p role="alert" className="mb-4 text-[13px] text-[#B42318]">{portalError}</p>}

                        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <PanelStat label="Paid To Date" value={money(paidTotal)} />
                            <PanelStat
                                label="Outstanding"
                                value={money(outstanding)}
                                hint={
                                    outstanding === 0
                                        ? "Nothing due"
                                        : `${openInvoices} invoice${openInvoices === 1 ? "" : "s"} to pay`
                                }
                            />
                            <PanelStat
                                label="Retainer"
                                value={data.retainerCents === null ? "—" : money(data.retainerCents)}
                                hint={data.subscription?.interval ? `Per ${data.subscription.interval}` : undefined}
                            />
                            <PanelStat
                                label="Renews"
                                value={
                                    data.subscription?.cancelAtPeriodEnd
                                        ? "Cancels"
                                        : data.subscription
                                          ? date(data.subscription.currentPeriodEnd)
                                          : "—"
                                }
                                hint={
                                    data.subscription
                                        ? data.subscription.cancelAtPeriodEnd
                                            ? `Ends ${date(data.subscription.currentPeriodEnd)}`
                                            : "Automatic renewal on"
                                        : "No subscription"
                                }
                            />
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <PanelCard>
                                <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                    <h3 className="text-[13px] font-semibold text-[#111827]">Subscription</h3>
                                </div>
                                <div className="p-4">
                                    {!data.subscription ? (
                                        <p className="text-[13px] text-[#6B7280]">
                                            No subscription. Invoices are raised manually.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                                <PanelBadge
                                                    tone={data.subscription.status === "active" ? "positive" : "warning"}
                                                >
                                                    {data.subscription.status}
                                                </PanelBadge>
                                                {data.subscription.amountCents !== null && (
                                                    <span className="text-[#111827]">
                                                        {money(data.subscription.amountCents)}
                                                        {data.subscription.interval ? ` / ${data.subscription.interval}` : ""}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[13px] text-[#6B7280]">
                                                {data.subscription.cancelAtPeriodEnd
                                                    ? `Automatic renewal is off. Access ends ${date(data.subscription.currentPeriodEnd)}.`
                                                    : `Renews automatically on ${date(data.subscription.currentPeriodEnd)}.`}
                                            </p>
                                            {canManage && (
                                                <button
                                                    type="button"
                                                    onClick={() => void setAutoRenew(data.subscription!.cancelAtPeriodEnd)}
                                                    disabled={renewalBusy}
                                                    className="h-8 rounded-lg bg-[#F4F2F8] px-3 text-[12.5px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {renewalBusy
                                                        ? "Updating…"
                                                        : data.subscription.cancelAtPeriodEnd
                                                          ? "Turn Renewal On"
                                                          : "Turn Renewal Off"}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </PanelCard>

                            <PanelCard>
                                <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                    <h3 className="text-[13px] font-semibold text-[#111827]">Payment Methods</h3>
                                </div>
                                <div className="p-4">
                                    {data.paymentMethods.length === 0 ? (
                                        <p className="text-[13px] text-[#6B7280]">
                                            Nothing on file. Payments are collected by invoice until a method is added.
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {data.paymentMethods.map((method) => (
                                                <li key={method.id} className="flex flex-wrap items-center gap-2 text-[13px] text-[#111827]">
                                                    <span className="font-medium">{describeMethod(method)}</span>
                                                    {method.expMonth && method.expYear && (
                                                        <span className="text-[#6B7280]">
                                                            expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                                                        </span>
                                                    )}
                                                    {method.isDefault && <PanelBadge tone="accent">Default</PanelBadge>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </PanelCard>
                        </div>

                        <PanelCard>
                            <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                <h3 className="text-[13px] font-semibold text-[#111827]">Invoices</h3>
                            </div>
                            {data.invoices.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No invoices yet.</p>
                            ) : (
                                <PanelTable>
                                    <PanelThead>
                                        <PanelTr>
                                            <PanelTh>Invoice</PanelTh>
                                            <PanelTh>Date</PanelTh>
                                            <PanelTh>Due</PanelTh>
                                            <PanelTh>Description</PanelTh>
                                            <PanelTh>Status</PanelTh>
                                            <PanelTh className="!text-right">Amount</PanelTh>
                                            <PanelTh className="!text-right">Actions</PanelTh>
                                        </PanelTr>
                                    </PanelThead>
                                    <PanelTbody>
                                        {data.invoices.map((invoice) => (
                                            <PanelTr key={invoice.id}>
                                                <PanelTd className="whitespace-nowrap font-medium text-[#111827]">
                                                    {/* A draft has no number until Stripe finalises it. */}
                                                    {invoice.number ?? (
                                                        <span className="font-normal text-[#9CA3AF]">Not issued</span>
                                                    )}
                                                </PanelTd>
                                                <PanelTd className="whitespace-nowrap text-[#6B7280]">{date(invoice.created)}</PanelTd>
                                                <PanelTd className="whitespace-nowrap text-[#6B7280]">
                                                    {invoice.dueDate ? date(invoice.dueDate) : "On receipt"}
                                                </PanelTd>
                                                <PanelTd className="text-[#6B7280]">{invoice.description ?? "Retainer"}</PanelTd>
                                                <PanelTd>
                                                    <PanelBadge tone={INVOICE_TONES[invoice.status ?? ""] ?? "neutral"}>
                                                        {invoice.status ?? "unknown"}
                                                    </PanelBadge>
                                                </PanelTd>
                                                <PanelTd className="whitespace-nowrap text-right font-medium tabular-nums">
                                                    {money(invoice.totalCents, invoice.currency)}
                                                    {invoice.amountDueCents > 0 && invoice.status === "open" && (
                                                        <span className="block text-[11.5px] font-normal text-[#B42318]">
                                                            {money(invoice.amountDueCents, invoice.currency)} due
                                                        </span>
                                                    )}
                                                </PanelTd>
                                                <PanelTd className="text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        {/* Stripe's hosted page is where an open invoice is paid — it takes
                                                            the card, not us. Both open in a new tab so the panel is still
                                                            behind them when the reader comes back. */}
                                                        {invoice.status === "open" && invoice.hostedUrl && (
                                                            <a
                                                                href={invoice.hostedUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 rounded font-medium text-[#701CC0] hover:underline"
                                                            >
                                                                <FiExternalLink className="h-3.5 w-3.5" />
                                                                {canManage ? "Pay" : "View"}
                                                            </a>
                                                        )}
                                                        {invoice.hostedUrl && invoice.status !== "open" && (
                                                            <a
                                                                href={invoice.hostedUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="rounded font-medium text-[#701CC0] hover:underline"
                                                            >
                                                                View
                                                            </a>
                                                        )}
                                                        {invoice.pdfUrl ? (
                                                            <a
                                                                href={invoice.pdfUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 rounded font-medium text-[#701CC0] hover:underline"
                                                            >
                                                                <FiDownload className="h-3.5 w-3.5" />
                                                                PDF
                                                            </a>
                                                        ) : (
                                                            <span className="text-[#9CA3AF]">—</span>
                                                        )}
                                                    </div>
                                                </PanelTd>
                                            </PanelTr>
                                        ))}
                                    </PanelTbody>
                                </PanelTable>
                            )}
                        </PanelCard>

                        <div className="mt-4">
                            <PanelCard>
                                <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                    <h3 className="text-[13px] font-semibold text-[#111827]">Transaction Log</h3>
                                </div>
                                {data.payments.length === 0 ? (
                                    <p className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No payments yet.</p>
                                ) : (
                                    <PanelTable>
                                        <PanelThead>
                                            <PanelTr>
                                                <PanelTh>Date</PanelTh>
                                                <PanelTh>Detail</PanelTh>
                                                <PanelTh>Method</PanelTh>
                                                <PanelTh>Status</PanelTh>
                                                <PanelTh className="!text-right">Amount</PanelTh>
                                                <PanelTh className="!text-right">Receipt</PanelTh>
                                            </PanelTr>
                                        </PanelThead>
                                        <PanelTbody>
                                            {data.payments.map((payment) => (
                                                <PanelTr key={payment.id}>
                                                    <PanelTd className="whitespace-nowrap text-[#6B7280]">{date(payment.created)}</PanelTd>
                                                    <PanelTd className="text-[#111827]">
                                                        {payment.description ?? "Payment"}
                                                        {payment.failureMessage && (
                                                            <span className="block text-[12px] text-[#B42318]">{payment.failureMessage}</span>
                                                        )}
                                                        {payment.refundedCents > 0 && (
                                                            <span className="block text-[12px] text-[#6B7280]">
                                                                {money(payment.refundedCents, payment.currency)} refunded
                                                            </span>
                                                        )}
                                                    </PanelTd>
                                                    <PanelTd className="whitespace-nowrap text-[#6B7280]">
                                                        {payment.brand ? `${payment.brand} ••${payment.last4 ?? ""}` : "—"}
                                                    </PanelTd>
                                                    <PanelTd>
                                                        <PanelBadge tone={PAYMENT_TONES[payment.status] ?? "neutral"}>
                                                            {payment.status}
                                                        </PanelBadge>
                                                    </PanelTd>
                                                    <PanelTd className="text-right font-medium tabular-nums">
                                                        {money(payment.amountCents, payment.currency)}
                                                    </PanelTd>
                                                    <PanelTd className="text-right">
                                                        {payment.receiptUrl ? (
                                                            <a
                                                                href={payment.receiptUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="rounded font-medium text-[#701CC0] hover:underline"
                                                            >
                                                                View
                                                            </a>
                                                        ) : (
                                                            <span className="text-[#9CA3AF]">—</span>
                                                        )}
                                                    </PanelTd>
                                                </PanelTr>
                                            ))}
                                        </PanelTbody>
                                    </PanelTable>
                                )}
                            </PanelCard>
                        </div>
                    </>
                )}
            </PanelPage>
        </div>
    )
}

export default ClientBillingSection
