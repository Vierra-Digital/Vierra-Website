"use client";
import { useState, useEffect } from "react";
import { track } from "@/lib/track";
import { bricolage, inter } from "@/lib/fonts";
import { motion, AnimatePresence } from "framer-motion";
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

const TOTAL_STEPS = 2;

const REVENUE_OPTIONS = [
  { value: "$10k - $25k", label: "$10k - $25k" },
  { value: "$25k - $50k", label: "$25k - $50k" },
  { value: "$50k - $100k", label: "$50k - $100k" },
  { value: "$100k - $250k", label: "$100k - $250k" },
  { value: "$250k - $500k", label: "$250k - $500k" },
  { value: "$500k+", label: "$500k+" },
];

export function Modal({ isOpen, onClose }: ModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData(EMPTY_FORM);
      setSubmitted(false);
      setSubmitting(false);
      track("lead_form_open");
    }
  }, [isOpen]);

  const setField = (key: keyof FormState) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: id === "phoneNumber" ? formatPhone(value) : value }));
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
  const phoneValid = formData.phoneNumber.replace(/\D/g, "").length === 10;
  const websiteValid = /^(https?:\/\/)?([\w-]+\.)+[a-zA-Z]{2,}$/.test(formData.website.trim());
  const desiredValid = /^\$?\d[\d,]*(\+)?$/.test(formData.desiredRevenue.trim());

  const step1Valid =
    !!formData.fullName.trim() &&
    !!formData.email.trim() &&
    emailValid &&
    !!formData.phoneNumber.trim() &&
    phoneValid;

  const step2Valid =
    !!formData.website.trim() &&
    websiteValid &&
    // Revenue fields are optional (lower form friction) — only validate the
    // desired-revenue format if the user actually entered something.
    (!formData.desiredRevenue.trim() || desiredValid);

  const nextStep = () =>
    setStep((s) => {
      const next = Math.min(TOTAL_STEPS, s + 1);
      if (next !== s) track("lead_form_step", { step: next });
      return next;
    });
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (submitting || !step1Valid || !step2Valid) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        alert("Failed to submit the form. Please try again.");
        return;
      }
      setSubmitted(true);
      track("generate_lead");
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <ModalShell
      onClose={onClose}
      zIndexClass="z-[200]"
      backdropClassName="bg-[#0F0F14]/70 backdrop-blur-md"
      cardClassName={`relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white/90 shadow-[0_30px_80px_-28px_rgba(26,16,51,0.55)] ${inter.className}`}
      closeOnBackdrop={true}
      label="Book your free audit"
    >
      {!submitted && (
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

      {submitted ? (
        <SuccessView onClose={onClose} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-7 pb-6 pt-5 sm:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8F42FF]">
                Free Audit · Step {step} of {TOTAL_STEPS}
              </p>
              <h2 className={`mt-2 text-2xl font-semibold tracking-tight text-[#1A1033] sm:text-[1.7rem] ${bricolage.className}`}>
                Free Audit Call
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

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-7 pb-2 pt-1 sm:px-10">
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
                        value={formData.website}
                        onChange={handleChange}
                        className={`${inputClass} ${formData.website && !websiteValid ? "border-red-400 bg-red-50/50" : ""}`}
                        placeholder="https://yourwebsite.com"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field label="Current Monthly Revenue" htmlFor="monthlyRevenue" optional>
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
                        optional
                        error={formData.desiredRevenue && !desiredValid ? "Enter a valid amount." : undefined}
                      >
                        <input
                          id="desiredRevenue"
                          type="text"
                          value={formData.desiredRevenue}
                          onChange={handleChange}
                          className={`${inputClass} ${formData.desiredRevenue && !desiredValid ? "border-red-400 bg-red-50/50" : ""}`}
                          placeholder="$50,000+"
                        />
                      </Field>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#1A1033]/10 px-7 py-4 sm:px-10">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#6B6480] transition-colors hover:text-[#1A1033]"
              >
                <FiArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}

            {step < TOTAL_STEPS ? (
              <PrimaryButton
                onClick={nextStep}
                disabled={step === 1 && !step1Valid}
              >
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
                {submitting ? "Submitting..." : "Submit"}
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}

const SuccessView: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="relative flex flex-col items-center px-6 py-12 text-center sm:px-10">
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute right-3 top-3 rounded-md p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
    >
      <FiX className="h-5 w-5" />
    </button>
    <motion.div
      className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#701CC0] to-[#8F42FF] shadow-[0_12px_30px_-8px_rgba(112,28,192,0.6)]"
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.45 }}
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-[#8F42FF]/40"
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
      />
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
      Audit requested
    </h2>
    <p className="mx-auto mt-2 max-w-sm text-[15px] leading-7 text-[#6B6480]">
      Thanks for your interest in Vierra. We’ve received your details and our team will be in touch within 24 to 48 hours.
    </p>
    <motion.button
      type="button"
      onClick={onClose}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#701CC0] to-[#8F42FF] px-7 py-2.5 text-sm font-medium text-white shadow-[0_6px_20px_-6px_rgba(112,28,192,0.6)] transition-all duration-200 hover:shadow-[0_8px_26px_-6px_rgba(112,28,192,0.7)]"
    >
      Done
    </motion.button>
  </div>
);
