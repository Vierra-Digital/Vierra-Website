import React, { useState } from "react"
import { FiX } from "react-icons/fi"
import Modal from "@/components/ui/Modal"
import type { BillingDetails } from "@/lib/billing/billingDetails"

/**
 * Edit the billing details Stripe holds, without leaving the panel.
 *
 * Built in the same shape as the panel's other dialogs (Invite Staff, Edit Staff): one card, a
 * header row with the title and a close button, then a right-aligned Cancel/primary pair. It
 * writes straight through to Stripe — nothing is mirrored locally — so what comes back from the
 * save is what the card then shows.
 *
 * No card fields here, deliberately. Those stay on Stripe's own pages.
 */

const FIELD =
    "h-9 w-full rounded-[10px] border border-[#E4E0EC] bg-white px-3 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#701CC0]/35"

/** Shown as placeholder text so the field hints at the shape without submitting it. */
const PHONE_PLACEHOLDER = "+1 333 333 3333"

const LABEL = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]"

type Props = {
    details: BillingDetails | null | undefined
    /** Passed through to the endpoint so staff can name the client they are editing. */
    companyId: string | null
    onClose: () => void
    onSaved: () => void | Promise<void>
}

const EditBillingDetailsModal: React.FC<Props> = ({ details, companyId, onClose, onSaved }) => {
    const [name, setName] = useState(details?.name ?? "")
    const [email, setEmail] = useState(details?.email ?? "")
    const [phone, setPhone] = useState(details?.phone ?? "")
    const [line1, setLine1] = useState(details?.address?.line1 ?? "")
    const [line2, setLine2] = useState(details?.address?.line2 ?? "")
    const [city, setCity] = useState(details?.address?.city ?? "")
    const [state, setState] = useState(details?.address?.state ?? "")
    const [postalCode, setPostalCode] = useState(details?.address?.postalCode ?? "")
    const [country, setCountry] = useState(details?.address?.country ?? "")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const save = async () => {
        setSaving(true)
        setError("")
        try {
            const url = companyId
                ? `/api/client/billing-details?companyId=${encodeURIComponent(companyId)}`
                : "/api/client/billing-details"
            const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    address: { line1, line2, city, state, postalCode, country },
                }),
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(body?.message || "Could not save those details.")
            await onSaved()
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save those details.")
            setSaving(false)
        }
    }

    return (
        <Modal
            zIndexClass="z-[200]"
            backdropClassName="bg-black/50 backdrop-blur-sm"
            cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 text-[#111827]"
            label="Edit Billing Information"
            closeOnBackdrop={!saving}
            closeOnEscape={!saving}
            onClose={onClose}
        >
            <header className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
                    Edit Billing Information
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <FiX className="h-5 w-5" />
                </button>
            </header>

            <div className="space-y-3">
                <div>
                    <label className={LABEL} htmlFor="bd-name">Billed To</label>
                    <input id="bd-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Iron &amp; Water Co." />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor="bd-email">Email</label>
                        <input id="bd-email" type="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@example.com" />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-phone">Phone</label>
                        <input id="bd-phone" className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={PHONE_PLACEHOLDER} />
                    </div>
                </div>
                <div>
                    <label className={LABEL} htmlFor="bd-line1">Billing Address</label>
                    <input id="bd-line1" className={FIELD} value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="3 Ashland Street" />
                </div>
                <div>
                    <label className={LABEL} htmlFor="bd-line2">Address Line 2</label>
                    <input id="bd-line2" className={FIELD} value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Suite 200" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className={LABEL} htmlFor="bd-city">City</label>
                        <input id="bd-city" className={FIELD} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Medford" />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-state">State</label>
                        <input id="bd-state" className={FIELD} value={state} onChange={(e) => setState(e.target.value)} placeholder="MA" />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-postal">Postal Code</label>
                        <input id="bd-postal" className={FIELD} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="02155" />
                    </div>
                </div>
                <div>
                    <label className={LABEL} htmlFor="bd-country">Country</label>
                    {/* Two letters, because that is what Stripe stores; the endpoint rejects
                        anything else rather than letting Stripe fail the whole update. */}
                    <input id="bd-country" className={FIELD} value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="US" />
                </div>
            </div>

            {error && <p role="alert" className="mt-3 text-[13px] text-[#B42318]">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </Modal>
    )
}

export default EditBillingDetailsModal
