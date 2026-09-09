import React, { useCallback, useState } from "react"
import { inter } from "@/lib/fonts"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import { useFetch } from "@/hooks/useFetch"
import { FiExternalLink } from "react-icons/fi"
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
import { billingRows, hasBillingDetails, type BillingDetails } from "@/lib/billing/billingDetails"
import { summariseBilling } from "@/lib/billing/summary"
import { invoiceDueDate } from "@/lib/billing/dueDate"
import EditBillingDetailsModal from "@/components/panel/EditBillingDetailsModal"

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
    /** The hosted invoice this charge paid, when it paid one; the column reads Invoice. */
    invoiceUrl?: string | null
    failureMessage: string | null
    brand: string | null
    last4: string | null
}

type Billing = {
    connected: boolean
    clientName?: string | null
    billingDetails?: BillingDetails | null
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

/** Stripe reports statuses lowercase; they are read here as words, not as API values. */
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")

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

/**
 * What an invoice line is called on the page.
 *
 * Stripe names the first invoice of a subscription "Subscription creation", which is its own
 * internal wording for the event and means nothing to the client reading their invoice. Anything
 * Stripe generated itself is replaced with the name of the thing actually being billed; a line a
 * human wrote is left exactly as written.
 */
const GENERATED_LINES = new Set(["subscription creation", "subscription update", "subscription"])
const DEFAULT_LINE = "Vierra Lead Generation Retainer"

const describeLine = (description: string | null) => {
    const trimmed = (description ?? "").trim()
    if (!trimmed || GENERATED_LINES.has(trimmed.toLowerCase())) return DEFAULT_LINE
    return trimmed
}

/** The Transaction Log's own default, distinct from the invoice line's. */
const DEFAULT_TRANSACTION = "Vierra Lead Generation"

const describeTransaction = (description: string | null) => {
    const trimmed = (description ?? "").trim()
    if (!trimmed || GENERATED_LINES.has(trimmed.toLowerCase())) return DEFAULT_TRANSACTION
    return trimmed
}

/** "Succeeded" is Stripe's word for the charge state; the log reads as a ledger. */
const PAYMENT_LABELS: Record<string, string> = {
    succeeded: "Completed",
}

/** "visa" reads as "Visa"; a bank account says which bank rather than which brand. */
const describeMethod = (method: PaymentMethod) => {
    if (method.type === "card") {
        const brand = method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : "Card"
        return `${brand} ending in ${method.last4 ?? "••••"}.`
    }
    if (method.type === "us_bank_account") {
        return `${method.bankName ?? "Bank account"} ending in ${method.last4 ?? "••••"}.`
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
    const [editingDetails, setEditingDetails] = useState(false)

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

    // See lib/billing/summary for which Stripe rows each figure counts, and why.
    const { paidCents, refundedCents, outstandingCents, openInvoiceCount } = summariseBilling(
        data?.invoices ?? [],
        data?.payments ?? []
    )

    return (
        <div className={inter.className}>
            <PanelPage>
                <PanelHeader title="Billing" />

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
                            <PanelStat
                                label="Paid To Date"
                                value={money(paidCents)}
                                // A refund is named when there is one, so the figure reconciles
                                // with the Transaction Log below rather than looking short by that
                                // amount. "Total" otherwise, so the tile never sits captionless
                                // beside three that carry one.
                                hint={refundedCents > 0 ? `Total, after ${money(refundedCents)} refunded` : "Total"}
                            />
                            <PanelStat
                                label="Outstanding"
                                value={money(outstandingCents)}
                                hint={
                                    outstandingCents === 0
                                        ? "Nothing Due"
                                        : `${openInvoiceCount} invoice${openInvoiceCount === 1 ? "" : "s"} to pay`
                                }
                            />
                            <PanelStat
                                label="Retainer"
                                value={data.retainerCents === null ? "—" : money(data.retainerCents)}
                                hint={data.subscription?.interval ? `Per ${titleCase(data.subscription.interval)}` : undefined}
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
                                            : "Automatic Renewal On"
                                        : "No subscription"
                                }
                            />
                        </div>

                        {/* One card for everything about the account rather than three.
                            Subscription and Payment Methods were separate boxes saying things that
                            belong with the address they are billed to — and the renewal state was
                            already in the Renews tile above, so the box was mostly repeating it.
                            The renewal control came with it; removing the boxes should not remove
                            the only way to turn renewal off. */}
                        <PanelCard className="mb-4">
                            <div className="border-b border-[#EEF1F7] bg-[#FBFCFF] px-4 py-3">
                                <h3 className="text-[13px] font-semibold text-[#111827]">Billing Information</h3>
                            </div>
                            <div className="p-4">
                                {/* A definition list on a fixed label column, so the values line up
                                    with each other rather than each starting wherever its own label
                                    happened to end. */}
                                <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                                    {/* Index-keyed: the address continuation rows deliberately
                                        share an empty label, so the label is not unique. */}
                                    {hasBillingDetails(data.billingDetails) ? (
                                        billingRows(data.billingDetails!).map(([label, value], i) => (
                                            <React.Fragment key={`${label}-${i}`}>
                                                <dt className="text-[#6B7280]">{label}</dt>
                                                <dd className="min-w-0 break-words text-[#111827]">{value}</dd>
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <>
                                            <dt className="text-[#6B7280]">Billed to</dt>
                                            <dd className="text-[#6B7280]">
                                                Not set. Captured at the first payment, or set in Stripe.
                                            </dd>
                                        </>
                                    )}

                                    <dt className="text-[#6B7280]">Payment Method</dt>
                                    <dd className="min-w-0 text-[#111827]">
                                        {data.paymentMethods.length === 0 ? (
                                            <span className="text-[#6B7280]">
                                                Nothing on file — collected by invoice.
                                            </span>
                                        ) : (
                                            <ul className="space-y-1">
                                                {data.paymentMethods.map((method) => (
                                                    <li key={method.id} className="flex flex-wrap items-center gap-2">
                                                        <span>{describeMethod(method)}</span>
                                                        {method.expMonth && method.expYear && (
                                                            <span className="text-[#6B7280]">
                                                                Expires at {String(method.expMonth).padStart(2, "0")}/
                                                                {method.expYear}
                                                            </span>
                                                        )}
                                                        {method.isDefault && <PanelBadge tone="accent">Default</PanelBadge>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </dd>

                                    <dt className="text-[#6B7280]">Renewal</dt>
                                    <dd className="min-w-0 text-[#111827]">
                                        {!data.subscription ? (
                                            <span className="text-[#6B7280]">
                                                No subscription — invoices are raised manually.
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                <span>
                                                    {data.subscription.cancelAtPeriodEnd
                                                        ? `Off. Access ends ${date(data.subscription.currentPeriodEnd)}.`
                                                        : `Renews on ${date(data.subscription.currentPeriodEnd)}.`}
                                                </span>
                                                {canManage && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void setAutoRenew(data.subscription!.cancelAtPeriodEnd)}
                                                        disabled={renewalBusy}
                                                        className="h-7 rounded-lg bg-[#F4F2F8] px-2.5 text-[12px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-50"
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
                                    </dd>
                                </dl>

                                {/* Under the details rather than in the header, so it is where
                                    someone who has just read them and spotted a typo is looking. */}
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingDetails(true)}
                                        className="h-9 rounded-[10px] bg-[#4C1191] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3B0D71]"
                                    >
                                        Edit Billing Information
                                    </button>
                                    {/* The two halves of "billing": the details are ours to edit,
                                        the card is Stripe's. This one leaves the panel. */}
                                    <button
                                        type="button"
                                        onClick={() => void openPortal()}
                                        disabled={openingPortal}
                                        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#D8D2E4] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:border-[#701CC0]/45 hover:bg-[#F5F3F9] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FiExternalLink className="h-4 w-4" />
                                        {openingPortal ? "Opening…" : "Manage Payments"}
                                    </button>
                                </div>
                            </div>
                        </PanelCard>

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
                                                    {date(invoiceDueDate({ createdIso: invoice.created, stripeDueIso: invoice.dueDate, renewalIso: data.subscription?.currentPeriodEnd ?? null }))}
                                                </PanelTd>
                                                <PanelTd className="text-[#6B7280]">{describeLine(invoice.description)}</PanelTd>
                                                <PanelTd>
                                                    <PanelBadge tone={INVOICE_TONES[invoice.status ?? ""] ?? "neutral"}>
                                                        {titleCase(invoice.status ?? "unknown")}
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
                                                    <div className="flex items-center justify-end gap-3 empty:before:text-[#9CA3AF] empty:before:content-['—']">
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
                                                <PanelTh className="!text-right">Invoice</PanelTh>
                                            </PanelTr>
                                        </PanelThead>
                                        <PanelTbody>
                                            {data.payments.map((payment) => (
                                                <PanelTr key={payment.id}>
                                                    <PanelTd className="whitespace-nowrap text-[#6B7280]">{date(payment.created)}</PanelTd>
                                                    <PanelTd className="text-[#111827]">
                                                        {describeTransaction(payment.description)}
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
                                                        {payment.brand ? `${titleCase(payment.brand)} ••${payment.last4 ?? ""}` : "—"}
                                                    </PanelTd>
                                                    <PanelTd>
                                                        <PanelBadge tone={PAYMENT_TONES[payment.status] ?? "neutral"}>
                                                            {PAYMENT_LABELS[payment.status] ?? titleCase(payment.status)}
                                                        </PanelBadge>
                                                    </PanelTd>
                                                    <PanelTd className="text-right font-medium tabular-nums">
                                                        {money(payment.amountCents, payment.currency)}
                                                    </PanelTd>
                                                    <PanelTd className="text-right">
                                                        {(payment.invoiceUrl ?? payment.receiptUrl) ? (
                                                            <a
                                                                href={(payment.invoiceUrl ?? payment.receiptUrl)!}
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

            {editingDetails && (
                <EditBillingDetailsModal
                    details={data?.billingDetails}
                    companyId={companyId}
                    onClose={() => setEditingDetails(false)}
                    onSaved={async () => {
                        await run()
                    }}
                />
            )}
        </div>
    )
}

export default ClientBillingSection
