"use client";
import React, { useState, useEffect } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud, FiFileText, FiX, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import Modal from "@/components/ui/Modal";
import {
  inputClass,
  labelClass,
  Field,
  PrimaryButton,
  OptionButtons,
  useLockBodyScroll,
  formatPhone,
} from "@/components/ui/modalForm";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface CareerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleSlug: string;
  roleTitle: string;
  /** True when the visitor has already applied for this role */
  alreadyApplied: boolean;
  /** Called after a successful submission so the parent can persist state */
  onSubmitted: () => void;
}

interface FormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  currentLocation: string;
  needRelocate: string;
  usCitizen: string;
  additionalNotes: string;
}

const EMPTY_FORM: FormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  currentLocation: "",
  needRelocate: "",
  usCitizen: "",
  additionalNotes: "",
};

const STEP_TITLES = ["Basic information", "Resume & cover letter", "Additional notes"];
const TOTAL_STEPS = STEP_TITLES.length;

export function CareerApplicationModal({
  isOpen,
  onClose,
  roleSlug,
  roleTitle,
  alreadyApplied,
  onSubmitted,
}: CareerApplicationModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Honeypot: real applicants never see or fill this field. Bots that fill every
  // field trip it, and the server silently no-ops instead of uploading.
  const [website, setWebsite] = useState("");

  useLockBodyScroll(isOpen);

  // Reset transient state whenever the modal is opened for a (possibly new) role.
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData(EMPTY_FORM);
      setResume(null);
      setCoverLetter(null);
      setSubmitted(false);
      setSubmitting(false);
      setSubmitError(null);
      setWebsite("");
    }
  }, [isOpen, roleSlug]);

  const setField = (key: keyof FormState) => (value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: id === "phoneNumber" ? formatPhone(value) : value }));
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
  const phoneValid = formData.phoneNumber.replace(/\D/g, "").length === 10;

  const basicInfoValid =
    !!formData.fullName.trim() &&
    !!formData.email.trim() &&
    emailValid &&
    !!formData.phoneNumber.trim() &&
    phoneValid &&
    !!formData.currentLocation.trim() &&
    !!formData.needRelocate &&
    !!formData.usCitizen;

  const attachmentsValid = !!resume && !!coverLetter;

  const nextStep = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (alreadyApplied || submitted || submitting || !basicInfoValid || !attachmentsValid) return;
    if (!resume || !coverLetter) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.append("roleSlug", roleSlug);
      body.append("fullName", formData.fullName.trim());
      body.append("email", formData.email.trim());
      body.append("phoneNumber", formData.phoneNumber.trim());
      body.append("currentLocation", formData.currentLocation.trim());
      body.append("needRelocate", formData.needRelocate);
      body.append("usCitizen", formData.usCitizen);
      body.append("additionalNotes", formData.additionalNotes.trim());
      body.append("website", website); // honeypot — always empty for real users
      body.append("resume", resume);
      body.append("coverLetter", coverLetter);

      const res = await fetch("/api/careers/apply", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showSuccess = submitted || alreadyApplied;
  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <Modal
      onClose={onClose}
      zIndexClass="z-[200]"
      backdropClassName="bg-[#1A1033]/50 backdrop-blur-md"
      cardClassName={`relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${inter.className}`}
      closeOnBackdrop={true}
      label={`Apply for ${roleTitle}`}
    >
      {/* Progress bar — inset rounded pill so it reads cleanly inside the rounded card */}
      {!showSuccess && (
        <div className="px-6 pt-4 sm:px-8">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#701CC0] to-[#8F42FF]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {showSuccess ? (
        <SuccessView roleTitle={roleTitle} firstTime={submitted} onClose={onClose} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-4 sm:px-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8F42FF]">
                Application · Step {step} of {TOTAL_STEPS}
              </p>
              <h2 className={`mt-1.5 text-xl font-semibold tracking-tight text-[#1A1033] sm:text-2xl ${bricolage.className}`}>
                {roleTitle}
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

          {/* Honeypot — invisible to sighted users and screen readers; real
              applicants never populate it. Kept off-screen rather than
              display:none, since some bots skip display:none fields. */}
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, width: 0, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2 sm:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Full Name" htmlFor="fullName">
                      <input
                        id="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={handleChange}
                        className={`${inputClass} border-gray-200`}
                        placeholder="John Doe"
                      />
                    </Field>
                    <Field
                      label="Email Address"
                      htmlFor="email"
                      error={formData.email && !emailValid ? "Enter a valid email address." : undefined}
                    >
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`${inputClass} ${formData.email && !emailValid ? "border-red-400 bg-red-50/50" : "border-gray-200"}`}
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
                        className={`${inputClass} ${formData.phoneNumber && !phoneValid ? "border-red-400 bg-red-50/50" : "border-gray-200"}`}
                        placeholder="(555) 123-4567"
                      />
                    </Field>
                    <Field label="Current Location" htmlFor="currentLocation">
                      <input
                        id="currentLocation"
                        type="text"
                        value={formData.currentLocation}
                        onChange={handleChange}
                        className={`${inputClass} border-gray-200`}
                        placeholder="City, State / Country"
                      />
                    </Field>
                    <Field label="Need to Relocate?">
                      <OptionButtons
                        value={formData.needRelocate}
                        onChange={setField("needRelocate")}
                        options={[
                          { value: "Yes", label: "Yes" },
                          { value: "No", label: "No" },
                        ]}
                      />
                    </Field>
                    <Field label="US Citizen?">
                      <OptionButtons
                        value={formData.usCitizen}
                        onChange={setField("usCitizen")}
                        options={[
                          { value: "Yes", label: "Yes" },
                          { value: "No", label: "No" },
                        ]}
                      />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <FileField id="resume" label="Resume" required file={resume} onSelect={setResume} />
                    <FileField id="coverLetter" label="Cover Letter" required file={coverLetter} onSelect={setCoverLetter} />
                  </div>
                )}

                {step === 3 && (
                  <Field label="Additional Notes" htmlFor="additionalNotes" optional>
                    <textarea
                      id="additionalNotes"
                      value={formData.additionalNotes}
                      onChange={handleChange}
                      rows={5}
                      className={`${inputClass} resize-none border-gray-200`}
                      placeholder="Anything else you'd like us to know?"
                    />
                  </Field>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="px-6 pt-3 sm:px-8">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 sm:px-8">
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
                disabled={(step === 1 && !basicInfoValid) || (step === 2 && !attachmentsValid)}
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
              <PrimaryButton onClick={handleSubmit} disabled={!basicInfoValid || !attachmentsValid || submitting}>
                {submitting ? "Submitting…" : "Submit Application"}
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Local sub-components ---------- */

interface FileFieldProps {
  id: string;
  label: string;
  file: File | null;
  onSelect: (f: File | null) => void;
  required?: boolean;
}

const FileField: React.FC<FileFieldProps> = ({ id, label, file, onSelect, required }) => (
  <div>
    <label className={labelClass}>
      {label}
      {!required && <span className="ml-1 font-normal text-gray-400">(Optional)</span>}
    </label>
    {file ? (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#701CC0]/20 bg-[#701CC0]/[0.04] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#701CC0] shadow-sm">
            <FiFileText className="h-5 w-5" />
          </span>
          <span className="truncate text-sm font-medium text-[#1A1033]">{file.name}</span>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label={`Remove ${label}`}
          className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-white hover:text-red-500"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <label
        htmlFor={id}
        className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-7 text-center transition-colors hover:border-[#701CC0]/50 hover:bg-[#701CC0]/[0.03]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#701CC0]/10 text-[#701CC0] transition-transform duration-200 group-hover:scale-110">
          <FiUploadCloud className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-[#3A3352]">
          Click To Upload <span className="text-[#701CC0]">{label}</span>
        </span>
        <span className="text-xs text-gray-400">PDF, DOC, or DOCX</span>
        <input
          id={id}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </label>
    )}
  </div>
);

const SuccessView: React.FC<{ roleTitle: string; firstTime: boolean; onClose: () => void }> = ({
  roleTitle,
  firstTime,
  onClose,
}) => (
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
      {/* Continuously pulsating glow rings */}
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-[#8F42FF]"
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
      {firstTime ? "Application Submitted" : "Application Received"}
    </h2>
    <p className="mx-auto mt-2 max-w-sm text-[15px] leading-7 text-[#6B6480]">
      {firstTime
        ? "We’ve received your application and our team will review it shortly."
        : `You’ve already applied for the ${roleTitle} role. Our team will be in touch if there’s a fit.`}
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
