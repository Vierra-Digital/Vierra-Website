import React, { useState, useRef, useEffect } from "react";
import { Inter as InterFont } from "next/font/google";
import { FiUser, FiCheck } from 'react-icons/fi'
import type { SessionItem } from "@/types/session";

const inter = InterFont({ subsets: ["latin"] });

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (row: SessionItem) => void;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [clientData, setClientData] = useState({ clientName: "", clientEmail: "", businessName: "", industry: "", monthlyRetainer: "" });
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSessionLink(null);
      setErr(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientData.clientEmail.trim());

  const nextStep = () => setStep((s) => s + 1);

  const handleSubmit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const payload = {
        clientName: clientData.clientName.trim(),
        clientEmail: clientData.clientEmail.trim().toLowerCase(),
        businessName: clientData.businessName.trim(),
        industry: clientData.industry.trim(),
        monthlyRetainer: Number(clientData.monthlyRetainer),
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
      setSessionLink(data.link as string);
      onCreated?.(data.summary);
      nextStep();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate session");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (step === 2 && sessionLink && clientData.clientEmail) {
      fetch("/api/sendSessionLinkEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clientData.clientEmail,
          link: `${origin}${sessionLink}`,
          clientName: clientData.clientName,
          businessName: clientData.businessName,
        }),
      }).catch(() => {});
    }
  }, [step, sessionLink, clientData.clientEmail, origin, clientData.clientName, clientData.businessName]);

  const handleFinish = () => {
    onClose();
  };

  const monthlyRetainerAmount = Number(clientData.monthlyRetainer);
  const monthlyRetainerValid =
    clientData.monthlyRetainer.trim() !== "" &&
    Number.isFinite(monthlyRetainerAmount) &&
    monthlyRetainerAmount > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleOutsideClick}>
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
      >

        <div className="flex items-center gap-3 mb-6">
          {step === 1 && (
            <>
              <div className="w-12 h-12 rounded-full bg-[#701CC0]/10 flex items-center justify-center">
                <FiUser className="w-6 h-6 text-[#701CC0]" />
              </div>
              <h3 id="add-client-title" className="text-xl font-semibold text-[#111827]">Add Client</h3>
            </>
          )}
        </div>

        {err && <div className="mb-4 rounded bg-red-500/20 p-2 text-sm text-red-100">{err}</div>}

        {step === 1 && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Client Name</label>
                <input
                  id="clientName"
                  name="clientName"
                  type="text"
                  value={clientData.clientName}
                  onChange={handleChange}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Enter client name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Client Email</label>
                <input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  value={clientData.clientEmail}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                    clientData.clientEmail && !emailValid 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-[#E5E7EB]'
                  }`}
                  placeholder="Enter email address"
                  required
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                />
                {!emailValid && clientData.clientEmail && (
                  <p className="mt-1 text-xs text-red-600">Please enter a valid email.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Business Name</label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  value={clientData.businessName}
                  onChange={handleChange}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Enter business name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Industry</label>
                <input
                  id="industry"
                  name="industry"
                  type="text"
                  value={clientData.industry}
                  onChange={handleChange}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent"
                  placeholder="Enter industry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Monthly Retainer (USD)</label>
                <input
                  id="monthlyRetainer"
                  name="monthlyRetainer"
                  type="number"
                  min="1"
                  step="0.01"
                  value={clientData.monthlyRetainer}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent ${
                    clientData.monthlyRetainer && !monthlyRetainerValid
                      ? "border-red-500 bg-red-50"
                      : "border-[#E5E7EB]"
                  }`}
                  placeholder="Enter monthly amount (e.g. 2500)"
                  required
                />
                {clientData.monthlyRetainer && !monthlyRetainerValid && (
                  <p className="mt-1 text-xs text-red-600">Please enter a valid amount greater than 0.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSubmit();
                }}
                disabled={!clientData.clientName.trim() || !clientData.clientEmail.trim() || !emailValid || !clientData.businessName.trim() || !clientData.industry.trim() || !monthlyRetainerValid}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  !clientData.clientName.trim() || !clientData.clientEmail.trim() || !emailValid || !clientData.businessName.trim() || !clientData.industry.trim() || !monthlyRetainerValid
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#701CC0] text-white hover:bg-[#5f17a5]'
                }`}
              >
                Create Client
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col items-center text-center p-6">
              <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                    <FiCheck className="h-6 w-6" />
                  </span>
                </span>
              </div>
              <h3 className="text-xl font-semibold text-[#111827] mb-2">Client Added Successfully!</h3>
              <p className={`text-sm text-[#6B7280] mb-4 ${inter.className}`}>An onboarding link has been sent to the client.</p>
              <button
                className={`mb-3 w-full rounded-lg px-4 py-2 text-sm ${copied ? 'bg-green-50 text-green-700 border border-green-200' : 'text-[#111827] border border-[#E5E7EB] hover:bg-gray-50'} ${inter.className}`}
                onClick={() => {
                  if (sessionLink) {
                    navigator.clipboard.writeText(`${origin}${sessionLink}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }
                }}
                disabled={!sessionLink}
              >
                {copied ? 'Copied To Clipboard' : 'Copy Session Link'}
              </button>
              <button
                className="w-full rounded-lg bg-[#5B21B6] px-4 py-2 text-white text-sm font-medium hover:bg-[#4C1D95]"
                onClick={handleFinish}
              >
                Done
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default AddClientModal;