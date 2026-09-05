"use client";
import { useState, useEffect, useRef } from "react";
import {
  AUDIT_REVENUE_OPTIONS,
  normalizeAuditSubmission,
  normalizeEmailAddress,
  normalizeHttpUrl,
  normalizePhoneNumber,
  normalizeRevenueAmount,
  PUBLIC_FORM_LIMITS,
} from "@/lib/publicFormValidation";
import { track } from "@/lib/track";
import { bricolage, inter } from "@/lib/fonts";
import { m as motion, AnimatePresence } from "framer-motion";
import { FiX, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import ModalShell from "@/components/ui/Modal";
import {
  inputClass,
  Field,
  PrimaryButton,
  ThemedSelect,
  useLockBodyScroll,
  formatPhone,
} from "@/components/ui/modalForm";
import AuditBookingStep from "@/components/audit/AuditBookingStep";
import { googleCalendarAddUrl, type BookingConfirmation } from "@/lib/booking/useBookingSlots";


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  website: string;
  monthlyRevenue: string;
  desiredRevenue: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  website: "",
  monthlyRevenue: "",
  desiredRevenue: "",
};

// 3 steps: contact info, business info, then the required booking calendar (AuditBookingStep)
// as the final step — same numbered progression as the rest of the form, not a bolt-on modal.
const TOTAL_STEPS = 3;

const REVENUE_OPTIONS = [
  ...AUDIT_REVENUE_OPTIONS.map((value) => ({ value, label: value })),
];

// Format a free-typed amount as US currency ($ + thousands separators) while the
// user types, preserving a trailing "+" (e.g. "50000+" -> "$50,000+"). Empty or
// all-zero input formats to an empty string so deletion clears cleanly.
function formatCurrency(value: string): string {
  const hasPlus = /\+\s*$/.test(value);
  const amount = Number(value.replace(/\D/g, ""));
  if (!amount) return "";
  return `$${amount.toLocaleString("en-US")}${hasPlus ? "+" : ""}`;
}

// Number of digit characters to the left of `pos` in `str`.
function digitsBefore(str: string, pos: number): number {
  return str.slice(0, pos).replace(/\D/g, "").length;
}

// Caret index in `formatted` that keeps `digitCount` digits to its left — used to
// restore the cursor after re-formatting so backspace/delete edit in place.
function caretForDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return formatted.startsWith("$") ? 1 : 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++count === digitCount) return i + 1;
  }
  return formatted.length;
}

// 'active' = steps 1-3 (contact info, business info, then the required booking calendar —
// step 3 is AuditBookingStep). No skip path out of step 3 — it's required, and a missing/
// unavailable booking link is currently swallowed inside AuditBookingStep itself rather than
// bouncing back up here (see the TODO in that file). 'done' = a time was booked.
type ModalPhase = "active" | "done";

export function Modal({ isOpen, onClose }: ModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [phase, setPhase] = useState<ModalPhase>("active");
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      // Clearing the form when the modal opens. These fields are state the user types into, so they cannot
      // be derived; keying this component from the caller is the alternative.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setFormData(EMPTY_FORM);
      setPhase("active");
      setConfirmation(null);
      setSubmitting(false);
      setHoneypot("");
      track("lead_form_open");
    }
  }, [isOpen]);

  // The desired-revenue field is UNCONTROLLED (defaultValue + a ref). We format
  // it imperatively on each keystroke and set the caret ourselves, so React's
  // controlled-input cursor handling never fights us — deletion, mid-string
  // edits, and separator removal all stay put and behave predictably.
  const desiredRef = useRef<HTMLInputElement>(null);

  const setField = (key: keyof FormState) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === "phoneNumber" ? formatPhone(value) : value,
    }));
  };

  const handleDesiredRevenue = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value;
    // How many digits sit left of the caret in the raw (pre-format) text, so we
    // can put the caret back after the same digit once it's re-formatted.
    const digitsLeft = digitsBefore(raw, input.selectionStart ?? raw.length);
    const formatted = formatCurrency(raw);
    // Write the formatted value straight to the DOM (input is uncontrolled) and
    // restore the caret in one synchronous pass — no React re-render race.
    input.value = formatted;
    const caret = caretForDigits(formatted, digitsLeft);
    input.setSelectionRange(caret, caret);
    // Keep form state in sync for validation/submit (does not re-render the input).
    setFormData((prev) => ({ ...prev, desiredRevenue: formatted }));
  };

  const emailValid = normalizeEmailAddress(formData.email) !== null;
  const phoneValid = normalizePhoneNumber(formData.phoneNumber) !== null;
  const websiteValid = normalizeHttpUrl(formData.website) !== null;
  const desiredValid = normalizeRevenueAmount(formData.desiredRevenue) !== null;

  const step1Valid =
    !!formData.fullName.trim() &&
    formData.fullName.trim().length <= PUBLIC_FORM_LIMITS.fullName &&
    !!formData.email.trim() &&
    emailValid &&
    !!formData.phoneNumber.trim() &&
    phoneValid;

  const step2Valid =
    !!formData.website.trim() &&
    websiteValid &&
    !!formData.monthlyRevenue &&
    !!formData.desiredRevenue.trim() &&
    desiredValid;

  const nextStep = () =>
    setStep((s) => {
      const next = Math.min(TOTAL_STEPS, s + 1);
      if (next !== s) track("lead_form_step", { step: next });
      return next;
    });
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  // Fires on the step-2 "Continue" — sends the lead notification, then advances to step 3
  // (the booking calendar) rather than closing the form out.
  const handleSubmit = async () => {
    if (submitting || !step1Valid || !step2Valid) return;
    const normalized = normalizeAuditSubmission(formData);
    if (!normalized) return;

    setSubmitting(true);
    try {
      // Internal lead notification only — this endpoint never sends a "you're confirmed"
      // auto-reply for this flow (see pages/api/sendEmail.ts). That confirmation comes solely
      // from the booking API once a real time is picked in step 3; a lead who never gets that
      // far intentionally gets no confirmation email at all, since none was actually booked.
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...normalized, company: honeypot }),
      });
      if (!response.ok) {
        alert("Failed to submit the form. Please try again.");
        return;
      }
      track("generate_lead");
      setStep(3);
      track("audit_booking_shown");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bookingNotes = [
    formData.website ? `Website: ${formData.website}` : "",
    formData.monthlyRevenue ? `Monthly revenue: ${formData.monthlyRevenue}` : "",
    formData.desiredRevenue ? `Desired revenue (12mo): ${formData.desiredRevenue}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const handleBooked = (result: BookingConfirmation) => {
    setConfirmation(result);
    setPhase("done");
    track("audit_booking_confirmed");
  };

  // A booked meeting IS the "meeting booked" signal (the Booking row created by
  // handleBooked's POST, visible in the existing booking system same as any other booking) —
  // no separate ad-hoc notification needed here. "Held" (attendance) tracking is likewise
  // just the existing meeting-tracking implementation, unchanged.
  //
  // No "booking link unavailable" fallback either — AuditBookingStep swallows a missing/empty
  // link into its own empty-calendar state and offers a "send us your availability" note
  // instead (see AuditBookingStep.tsx), rather than bouncing the modal to a different screen.

  if (!isOpen) return null;

  const progress = (step / TOTAL_STEPS) * 100;
  // No skip path out of step 3 (the booking calendar) — an accidental dismissal (outside
  // click or an Escape press, which is even easier to hit by accident) shouldn't be able to
  // discard a selected slot the way it can on steps 1-2. The header's X button is left
  // unguarded on purpose — that's a deliberate close, not an accidental one.
  const guardAccidentalClose = phase === "done" || step < 3;

  return (
    <ModalShell
      onClose={onClose}
      zIndexClass="z-[200]"
      backdropClassName="bg-[#0F0F14]/70 backdrop-blur-md"
      cardClassName={`relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-28px_rgba(26,16,51,0.55)] ${inter.className}`}
      closeOnBackdrop={guardAccidentalClose}
      closeOnEscape={guardAccidentalClose}
      label="Book your free audit"
    >
      {phase === "active" && (
        <div className="px-7 pt-5 sm:px-10">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#701CC0]/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#701CC0] to-[#8F42FF]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {phase === "done" ? (
        <SuccessView onClose={onClose} confirmation={confirmation} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-7 pb-6 pt-5 sm:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8F42FF]">
                Free Audit · Step {step} of {TOTAL_STEPS}
              </p>
              <h2 className={`mt-2 text-2xl font-semibold tracking-tight text-[#1A1033] sm:text-[1.7rem] ${bricolage.className}`}>
                {step === 3 ? "Book Your Call" : "Free Audit Call"}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Honeypot â€” kept off-screen so form-filling bots see it but real
              visitors do not. The API silently ignores filled submissions. */}
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, width: 0, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor="company">Company</label>
            <input
              id="company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Scrollable body — scrollbar hidden (rarely needed; only on short
              viewports), matching the rest of the site's chrome-free scroll. */}
          <div className="modal-scroll-area flex-1 overflow-y-auto px-7 pb-2 pt-1 sm:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {step === 1 && (
                  <>
                    <Field label="Full Name" htmlFor="fullName">
                      <input
                        id="fullName"
                        type="text"
                        maxLength={PUBLIC_FORM_LIMITS.fullName}
                        value={formData.fullName}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="John Doe"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field
                        label="Email"
                        htmlFor="email"
                        error={formData.email && !emailValid ? "Enter a valid email address." : undefined}
                      >
                        <input
                          id="email"
                          type="email"
                          maxLength={PUBLIC_FORM_LIMITS.email}
                          value={formData.email}
                          onChange={handleChange}
                          className={`${inputClass} ${formData.email && !emailValid ? "border-red-400 bg-red-50/50" : ""}`}
                          placeholder="john@example.com"
                        />
                      </Field>
                      <Field
                        label="Phone Number"
                        htmlFor="phoneNumber"
                        error={formData.phoneNumber && !phoneValid ? "Enter a valid phone number." : undefined}
                      >
                        <input
                          id="phoneNumber"
                          type="tel"
                          maxLength={PUBLIC_FORM_LIMITS.phoneNumber}
                          inputMode="numeric"
                          value={formData.phoneNumber}
                          onChange={handleChange}
                          className={`${inputClass} ${formData.phoneNumber && !phoneValid ? "border-red-400 bg-red-50/50" : ""}`}
                          placeholder="(555) 123-4567"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Field
                      label="Website"
                      htmlFor="website"
                      error={formData.website && !websiteValid ? "Enter a valid website." : undefined}
                    >
                      <input
                        id="website"
                        type="url"
                        maxLength={PUBLIC_FORM_LIMITS.website}
                        value={formData.website}
                        onChange={handleChange}
                        className={`${inputClass} ${formData.website && !websiteValid ? "border-red-400 bg-red-50/50" : ""}`}
                        placeholder="https://vierradev.com"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field label="Current Monthly Revenue" htmlFor="monthlyRevenue">
                        <ThemedSelect
                          id="monthlyRevenue"
                          value={formData.monthlyRevenue}
                          onChange={setField("monthlyRevenue")}
                          options={REVENUE_OPTIONS}
                          placeholder="Select revenue range"
                        />
                      </Field>
                      <Field
                        label="Desired Revenue (12 months)"
                        htmlFor="desiredRevenue"
                        error={formData.desiredRevenue && !desiredValid ? "Enter a valid amount." : undefined}
                      >
                        <input
                          ref={desiredRef}
                          id="desiredRevenue"
                          type="text"
                          maxLength={PUBLIC_FORM_LIMITS.desiredRevenue}
                          inputMode="numeric"
                          defaultValue={formData.desiredRevenue}
                          onChange={handleDesiredRevenue}
                          className={`${inputClass} ${formData.desiredRevenue && !desiredValid ? "border-red-400 bg-red-50/50" : ""}`}
                          placeholder="$50,000+"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <AuditBookingStep
                    prefill={{ name: formData.fullName, email: formData.email, notes: bookingNotes }}
                    onBooked={handleBooked}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer — steps 1-2 only. Step 3's confirm action lives inside
              AuditBookingStep itself, next to the selected time. */}
          {step < 3 && (
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#1A1033]/10 px-7 py-4 sm:px-10">
              {step > 1 ? (
                <button
                  onClick={prevStep}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6B6480] transition-colors hover:text-[#1A1033]"
                >
                  <FiArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <span />
              )}

              {step === 1 ? (
                <PrimaryButton onClick={nextStep} disabled={!step1Valid}>
                  Continue
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <FiArrowRight className="h-4 w-4" />
                  </motion.span>
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={handleSubmit} disabled={submitting || !step1Valid || !step2Valid}>
                  {submitting ? "Submitting..." : "Continue"}
                  {!submitting && (
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <FiArrowRight className="h-4 w-4" />
                    </motion.span>
                  )}
                </PrimaryButton>
              )}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

const SuccessView: React.FC<{ onClose: () => void; confirmation: BookingConfirmation | null }> = ({ onClose, confirmation }) => (
  <div className="relative flex flex-col items-center px-6 py-12 text-center sm:px-10">
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute right-3 top-3 rounded-md p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <FiX className="h-5 w-5" />
    </button>
    <motion.div
      className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#16A34A] to-[#22C55E] shadow-[0_12px_30px_-8px_rgba(22,163,74,0.6)]"
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.45 }}
    >
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-[#22C55E]"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.85, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: i }}
        />
      ))}
      <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
    <h2 className={`text-2xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
      {confirmation ? "You're Booked" : "Free Audit Claimed"}
    </h2>
    <p className="mx-auto mt-2 max-w-sm text-[15px] leading-7 text-[#6B6480]">
      {confirmation
        ? `See you ${confirmation.when}. A calendar invite and video link are on their way to your inbox.`
        : "We’ve received your details and our team will be in touch within 24 hours."}
    </p>
    {confirmation ? (
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <a
          href={googleCalendarAddUrl(confirmation)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#701CC0] hover:underline"
        >
          Add to Google Calendar
        </a>
        {confirmation.id ? (
          <a
            href={`/manage/${confirmation.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#9A93AE] hover:underline"
          >
            Need to reschedule or cancel?
          </a>
        ) : null}
      </div>
    ) : null}
    <motion.button
      type="button"
      onClick={onClose}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#701CC0] to-[#8F42FF] px-7 py-2.5 text-sm font-medium text-white shadow-[0_6px_20px_-6px_rgba(112,28,192,0.6)] transition-all duration-200 hover:shadow-[0_8px_26px_-6px_rgba(112,28,192,0.7)]"
    >
      Done
    </motion.button>
  </div>
);
