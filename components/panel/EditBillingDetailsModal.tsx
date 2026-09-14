import React, { useMemo, useState } from "react"
import { FiChevronDown, FiX } from "react-icons/fi"
import Modal from "@/components/ui/Modal"
import type { BillingDetails } from "@/lib/billing/billingDetails"
import {
    COUNTRIES,
    SUBDIVISIONS,
    formatPhone,
    validateBillingForm,
    type BillingForm,
    type FieldErrors,
} from "@/lib/billing/billingForm"

/**
 * Edit the billing details Stripe holds, without leaving the panel.
 *
 * Same shape as the panel's other dialogs (Invite Staff, Edit Staff): one card, a header row with
 * the title and a close button, a right-aligned Cancel/primary pair, and a primary button that
 * stays disabled until the form is acceptable — so a submit cannot fail on something the form
 * already knew was wrong.
 *
 * The rules live in lib/billing/billingForm, tested on their own, so the form and the endpoint
 * cannot drift into disagreeing about what a valid address is.
 *
 * No card fields here, deliberately. Those stay on Stripe's own pages.
 */

const FIELD_BASE =
    "h-9 w-full rounded-[10px] border px-3 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
const FIELD_OK = "border-[#E4E0EC] bg-white focus:ring-[#701CC0]/35"
const FIELD_BAD = "border-[#F0A9A3] bg-[#FEF8F7] focus:ring-[#B42318]/30"

const LABEL = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]"

/** Shown as placeholder text so the field hints at the shape without submitting it. */
const PHONE_PLACEHOLDER = "+1 333 333 3333"

/** The message under a field, or nothing. Module-level so it is one component type, not a new
 *  one on every render. */
const FieldError: React.FC<{ message?: string }> = ({ message }) =>
    message ? (
        <p role="alert" className="mt-1 text-[11.5px] text-[#B42318]">
            {message}
        </p>
    ) : null

type Props = {
    details: BillingDetails | null | undefined
    /** Passed through to the endpoint so staff can name the client they are editing. */
    companyId: string | null
    onClose: () => void
    onSaved: () => void | Promise<void>
}

const EditBillingDetailsModal: React.FC<Props> = ({ details, companyId, onClose, onSaved }) => {
    const [form, setForm] = useState<BillingForm>({
        name: details?.name ?? "",
        email: details?.email ?? "",
        phone: details?.phone ?? "",
        line1: details?.address?.line1 ?? "",
        line2: details?.address?.line2 ?? "",
        city: details?.address?.city ?? "",
        state: details?.address?.state ?? "",
        postalCode: details?.address?.postalCode ?? "",
        country: details?.address?.country ?? "",
    })
    /**
     * Errors are computed for every field but only shown once a field has been touched, so the
     * dialog does not open covered in red before anything has been typed. The button still knows
     * about all of them.
     */
    const [touched, setTouched] = useState<Partial<Record<keyof BillingForm, boolean>>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const errors: FieldErrors = useMemo(() => validateBillingForm(form), [form])
    const canSave = Object.keys(errors).length === 0 && !saving

    const set = (key: keyof BillingForm, value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }))
    const blur = (key: keyof BillingForm) => setTouched((prev) => ({ ...prev, [key]: true }))
    const shown = (key: keyof BillingForm) => (touched[key] ? errors[key] : undefined)

    /** Only the two countries with a list; everywhere else keeps a free-text region field. */
    const subdivisions = SUBDIVISIONS[form.country.toUpperCase()] ?? null

    const inputClass = (key: keyof BillingForm) =>
        `${FIELD_BASE} ${shown(key) ? FIELD_BAD : FIELD_OK}`

    const save = async () => {
        // Everything counts as touched on submit, so a field the person never visited still shows
        // why the button was disabled.
        setTouched({
            name: true, email: true, phone: true, line1: true, line2: true,
            city: true, state: true, postalCode: true, country: true,
        })
        if (Object.keys(errors).length > 0) return

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
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    address: {
                        line1: form.line1,
                        line2: form.line2,
                        city: form.city,
                        state: form.state,
                        postalCode: form.postalCode,
                        country: form.country,
                    },
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
                    <input
                        id="bd-name"
                        className={inputClass("name")}
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        onBlur={() => blur("name")}
                        aria-invalid={!!shown("name")}
                        placeholder="Iron &amp; Water Co."
                    />
                    <FieldError message={shown("name")} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className={LABEL} htmlFor="bd-email">Email</label>
                        <input
                            id="bd-email"
                            type="email"
                            className={inputClass("email")}
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            onBlur={() => blur("email")}
                            aria-invalid={!!shown("email")}
                            placeholder="billing@example.com"
                        />
                        <FieldError message={shown("email")} />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-phone">Phone</label>
                        <input
                            id="bd-phone"
                            inputMode="tel"
                            className={inputClass("phone")}
                            value={form.phone}
                            // Reformatted as it is typed, so the stored value has one shape rather
                            // than whatever each person happened to key in.
                            onChange={(e) => set("phone", formatPhone(e.target.value))}
                            onBlur={() => blur("phone")}
                            aria-invalid={!!shown("phone")}
                            placeholder={PHONE_PLACEHOLDER}
                        />
                        <FieldError message={shown("phone")} />
                    </div>
                </div>

                <div>
                    <label className={LABEL} htmlFor="bd-line1">Billing Address</label>
                    <input
                        id="bd-line1"
                        className={inputClass("line1")}
                        value={form.line1}
                        onChange={(e) => set("line1", e.target.value)}
                        onBlur={() => blur("line1")}
                        aria-invalid={!!shown("line1")}
                        placeholder="3 Ashland Street"
                    />
                    <FieldError message={shown("line1")} />
                </div>

                <div>
                    <label className={LABEL} htmlFor="bd-line2">Address Line 2</label>
                    <input
                        id="bd-line2"
                        className={inputClass("line2")}
                        value={form.line2}
                        onChange={(e) => set("line2", e.target.value)}
                        onBlur={() => blur("line2")}
                        placeholder="Suite 200"
                    />
                    <FieldError message={shown("line2")} />
                </div>

                <div>
                    <label className={LABEL} htmlFor="bd-country">Country</label>
                    <span className="relative block">
                        <select
                            id="bd-country"
                            className={`${inputClass("country")} appearance-none pr-9`}
                            value={form.country.toUpperCase()}
                            onChange={(e) => {
                                // A state from the old country is meaningless under the new one.
                                setForm((prev) => ({ ...prev, country: e.target.value, state: "" }))
                                setTouched((prev) => ({ ...prev, country: true }))
                            }}
                        >
                            <option value="">Not set</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" aria-hidden />
                    </span>
                    <FieldError message={shown("country")} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                        <label className={LABEL} htmlFor="bd-city">City</label>
                        <input
                            id="bd-city"
                            className={inputClass("city")}
                            value={form.city}
                            onChange={(e) => set("city", e.target.value)}
                            onBlur={() => blur("city")}
                            placeholder="Medford"
                        />
                        <FieldError message={shown("city")} />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-state">
                            {form.country.toUpperCase() === "CA" ? "Province" : "State"}
                        </label>
                        {subdivisions ? (
                            <span className="relative block">
                                <select
                                    id="bd-state"
                                    className={`${inputClass("state")} appearance-none pr-9`}
                                    value={form.state.toUpperCase()}
                                    onChange={(e) => {
                                        set("state", e.target.value)
                                        blur("state")
                                    }}
                                >
                                    <option value="">Not set</option>
                                    {subdivisions.map((s) => (
                                        <option key={s.code} value={s.code}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" aria-hidden />
                            </span>
                        ) : (
                            /* Free text where we have no list — inventing one for every country
                               would reject regions that are perfectly real. */
                            <input
                                id="bd-state"
                                className={inputClass("state")}
                                value={form.state}
                                onChange={(e) => set("state", e.target.value)}
                                onBlur={() => blur("state")}
                                placeholder="Region"
                            />
                        )}
                        <FieldError message={shown("state")} />
                    </div>
                    <div>
                        <label className={LABEL} htmlFor="bd-postal">Postal Code</label>
                        <input
                            id="bd-postal"
                            className={inputClass("postalCode")}
                            value={form.postalCode}
                            onChange={(e) => set("postalCode", e.target.value)}
                            onBlur={() => blur("postalCode")}
                            aria-invalid={!!shown("postalCode")}
                            placeholder={form.country.toUpperCase() === "CA" ? "K1A 0B1" : "02155"}
                        />
                        <FieldError message={shown("postalCode")} />
                    </div>
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
                    disabled={!canSave}
                    className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(112,28,192,0.35)] transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </Modal>
    )
}

export default EditBillingDetailsModal
