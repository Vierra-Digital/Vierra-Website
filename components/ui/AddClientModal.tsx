import React, { useState, useEffect, useRef } from "react";
import { EMAIL_REGEX } from "@/lib/utils";
import { inter } from "@/lib/fonts";
import { FiCheck } from 'react-icons/fi'
import type { SessionItem } from "@/types/session";
import Modal from "@/components/ui/Modal";
import {
  PANEL_FIELD,
  PANEL_FIELD_INVALID,
  PanelFieldLabel,
  PanelModalFooter,
  PanelModalHeader,
} from "@/components/ui/PanelForm";


interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (row: SessionItem) => void;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onCreated }) => {
  // Kept as a plain progress counter now that the wizard is one screen: 1 while the form is up,
  // 3 once the client exists. The draft guard and the onboarding-email effect both read it.
  const [step, setStep] = useState(1);
  const [clientData, setClientData] = useState({ firstName: "", lastName: "", clientEmail: "", businessName: "", industry: "", monthlyRetainer: "", clientGoal: "" });
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  // Read once at first render rather than set from an effect, which rendered an empty origin
  // and then immediately re-rendered. Guarded for the server, where there is no location.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pending = useRef(false);
  const [emailStatus, setEmailStatus] = useState("");
  const close = () => {
    if (pending.current) return;
    onClose();
  };
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Clearing the wizard when the modal opens, so a previous invite link does not leak into the next
      // one.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setSessionLink(null);
      setErr(null);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNumericChange = (name: "monthlyRetainer" | "clientGoal", value: string) => {
    const isMonthlyRetainer = name === "monthlyRetainer";
    const pattern = isMonthlyRetainer ? /^\d*\.?\d{0,2}$/ : /^\d*$/;
    if (!pattern.test(value)) return;
    setClientData((prev) => ({ ...prev, [name]: value }));
  };

  const emailValid = EMAIL_REGEX.test(clientData.clientEmail.trim());

  const nextStep = () => setStep((s) => s + 1);

  const handleSubmit = async () => {
    if (pending.current) return;
    const basicInfoValid =
      !!clientData.firstName.trim() &&
      !!clientData.lastName.trim() &&
      !!clientData.clientEmail.trim() &&
      emailValid &&
      !!clientData.businessName.trim();
    const monthlyRetainerAmount = Number(clientData.monthlyRetainer);
    const monthlyRetainerValid =
      clientData.monthlyRetainer.trim() !== "" &&
      Number.isFinite(monthlyRetainerAmount) &&
      monthlyRetainerAmount > 0;
    const clientGoalAmount = Number(clientData.clientGoal);
    const clientGoalValid =
      clientData.clientGoal.trim() !== "" &&
      Number.isInteger(clientGoalAmount) &&
      clientGoalAmount >= 0;
    const businessInfoValid = !!clientData.industry.trim() && monthlyRetainerValid && clientGoalValid;
    if (!basicInfoValid || !businessInfoValid || submitting) {
      if (!clientData.clientEmail.trim() || !emailValid) {
        setErr("Please enter a valid email address.");
      } else {
        setErr("Please complete all required fields before creating a client.");
      }
      return;
    }
    setErr(null);
    pending.current = true;
    setSubmitting(true);
    try {
      const payload = {
        clientName: `${clientData.firstName.trim()} ${clientData.lastName.trim()}`,
        clientEmail: clientData.clientEmail.trim().toLowerCase(),
        businessName: clientData.businessName.trim(),
        industry: clientData.industry.trim(),
        monthlyRetainer: Number(clientData.monthlyRetainer),
        clientGoal: Number(clientData.clientGoal),
      };
      const response = await fetch("/api/session/generateClientSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setEmailStatus("Sending onboarding email...");
      setSessionLink(data.link as string);
      onCreated?.(data.summary);
      nextStep();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate session");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (step === 3 && sessionLink && clientData.clientEmail) {
      fetch("/api/sendSessionLinkEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clientData.clientEmail,
          link: `${origin}${sessionLink}`,
          clientName: `${clientData.firstName.trim()} ${clientData.lastName.trim()}`,
          businessName: clientData.businessName,
        }),
      }).then(response => {
        setEmailStatus(response.ok ? "Onboarding email sent." : "Client created, but the email could not be confirmed. Copy and share the link below.");
      }).catch(() => setEmailStatus("Client created, but the email could not be confirmed. Copy and share the link below."));
    }
  }, [step, sessionLink, clientData.clientEmail, origin, clientData.firstName, clientData.lastName, clientData.businessName]);

  const handleFinish = () => {
    onClose();
  };

  const monthlyRetainerAmount = Number(clientData.monthlyRetainer);
  const monthlyRetainerValid =
    clientData.monthlyRetainer.trim() !== "" &&
    Number.isFinite(monthlyRetainerAmount) &&
    monthlyRetainerAmount > 0;
  const clientGoalAmount = Number(clientData.clientGoal);
  const clientGoalValid =
    clientData.clientGoal.trim() !== "" &&
    Number.isInteger(clientGoalAmount) &&
    clientGoalAmount >= 0;

  const basicInfoValid =
    !!clientData.firstName.trim() &&
    !!clientData.lastName.trim() &&
    !!clientData.clientEmail.trim() &&
    emailValid &&
    !!clientData.businessName.trim();

  const businessInfoValid =
    !!clientData.industry.trim() &&
    monthlyRetainerValid &&
    clientGoalValid;

  if (!isOpen) return null;

  // One screen rather than a two-step wizard. Six fields fit the same two-column grid Staff
  // Orbital's invite dialog uses, and the stepper was navigation over a form short enough not to
  // need any — you could not see what you were being asked for until you had answered half of it.
  const formValid = basicInfoValid && businessInfoValid;

  return (
    <Modal
      onClose={close}
      zIndexClass="z-50"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4"
      closeOnBackdrop={true}
      label="Add Client"
    >
      {sessionLink ? (
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-30" />
            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <FiCheck className="h-6 w-6" />
              </span>
            </span>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-[#111827]">Client Added</h3>
          <p className={`mb-6 text-sm text-[#6B7280] ${inter.className}`}>{emailStatus}</p>
          {err && <p className="mb-3 text-[13px] text-[#B42318]">{err}</p>}
          <button
            type="button"
            disabled={!sessionLink}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${origin}${sessionLink}`);
              } catch {
                setErr("Could not copy the link. Copy it from the address bar of the onboarding email instead.");
                return;
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`mb-2 h-9 w-full rounded-[10px] text-[13px] font-medium transition-colors ${
              copied
                ? "bg-green-50 text-green-700"
                : "bg-[#F4F2F8] text-[#374151] hover:bg-[#EAE6F3]"
            }`}
          >
            {copied ? "Copied To Clipboard" : "Copy Session Link"}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            className="h-9 w-full rounded-[10px] bg-[#701CC0] text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5]"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <PanelModalHeader title="Add Client" onClose={close} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <PanelFieldLabel required>First Name</PanelFieldLabel>
              <input
                name="firstName"
                type="text"
                value={clientData.firstName}
                onChange={handleChange}
                className={PANEL_FIELD}
                placeholder="Bidoof"
              />
            </div>
            <div>
              <PanelFieldLabel required>Last Name</PanelFieldLabel>
              <input
                name="lastName"
                type="text"
                value={clientData.lastName}
                onChange={handleChange}
                className={PANEL_FIELD}
                placeholder="Sanchez"
              />
            </div>
            <div>
              <PanelFieldLabel required>Business Name</PanelFieldLabel>
              <input
                name="businessName"
                type="text"
                value={clientData.businessName}
                onChange={handleChange}
                className={PANEL_FIELD}
                placeholder="Sanchez Dental"
              />
            </div>
            <div className="sm:col-span-2">
              <PanelFieldLabel required>Client Email</PanelFieldLabel>
              <input
                name="clientEmail"
                type="email"
                value={clientData.clientEmail}
                onChange={handleChange}
                className={clientData.clientEmail && !emailValid ? PANEL_FIELD_INVALID : PANEL_FIELD}
                placeholder="name@business.com"
                required
              />
            </div>
            <div>
              <PanelFieldLabel required>Industry</PanelFieldLabel>
              <input
                name="industry"
                type="text"
                value={clientData.industry}
                onChange={handleChange}
                className={PANEL_FIELD}
                placeholder="Dentistry"
              />
            </div>
            <div>
              <PanelFieldLabel required>Monthly Retainer</PanelFieldLabel>
              <input
                name="monthlyRetainer"
                type="text"
                inputMode="decimal"
                value={clientData.monthlyRetainer}
                onChange={(e) => handleNumericChange("monthlyRetainer", e.target.value)}
                className={PANEL_FIELD}
                placeholder="2500"
              />
            </div>
            <div>
              <PanelFieldLabel required>Client Goal</PanelFieldLabel>
              <input
                name="clientGoal"
                type="text"
                inputMode="numeric"
                value={clientData.clientGoal}
                onChange={(e) => handleNumericChange("clientGoal", e.target.value)}
                className={PANEL_FIELD}
                placeholder="40"
              />
              <p className="mt-1 text-[11.5px] text-[#9CA3AF]">Leads per month</p>
            </div>
          </div>

          {err && <p className="mt-4 text-[13px] text-[#B42318]">{err}</p>}

          <PanelModalFooter
            onCancel={close}
            onConfirm={() => void handleSubmit()}
            confirmLabel={submitting ? "Adding…" : "Add Client"}
            confirmDisabled={submitting || !formValid}
          />
        </>
      )}
    </Modal>
  );
};

export default AddClientModal;
