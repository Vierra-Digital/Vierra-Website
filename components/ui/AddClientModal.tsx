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
  const [clientData, setClientData] = useState({ clientName: "", clientEmail: "", businessName: "", industry: "" });
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
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
      setEmailSending(true);
      setEmailError(null);
      fetch("/api/sendSessionLinkEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clientData.clientEmail,
          link: `${origin}${sessionLink}`,
          clientName: clientData.clientName,
          businessName: clientData.businessName,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.message || "Failed to send email");
          }
          setEmailSent(true);
        })
        .catch((err) => {
          setEmailError(err.message || "Failed to send email");
        })
        .finally(() => {
          setEmailSending(false);
        });
    }
  }, [step, sessionLink, clientData.clientEmail, origin, clientData.clientName, clientData.businessName]);

  const handleFinish = () => {
    // by filling out the onboarding form via the link we sent them
    onClose();
  };

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
                  setStep(2);
                }}
                disabled={!clientData.clientName.trim() || !clientData.clientEmail.trim() || !emailValid || !clientData.businessName.trim() || !clientData.industry.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  !clientData.clientName.trim() || !clientData.clientEmail.trim() || !emailValid || !clientData.businessName.trim() || !clientData.industry.trim()
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

        {step === 3 && (
          <>
            <h3 className="mb-3 text-lg font-semibold">Session Link Generated</h3>
            <div className="mt-6">
              <p className={`mb-2 text-sm ${inter.className}`}>Share this link with {clientData.clientName}:</p>
              <div className="mb-4 break-all rounded border border-[#701CC0]/50 bg-[#18042A]/50 p-3">
                <p className={`text-sm text-blue-300 ${inter.className}`}>
                  {sessionLink ? `${origin}${sessionLink}` : "Generating..."}
                </p>
              </div>
              <button
                className={`mb-4 w-full rounded-md bg-blue-500 px-4 py-2 text-white shadow transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${inter.className}`}
                onClick={() => {
                  if (sessionLink) {
                    navigator.clipboard.writeText(`${origin}${sessionLink}`);
                    alert("Link copied to clipboard!");
                  }
                }}
                disabled={!sessionLink}
              >
                Copy Link
              </button>
              
              <div className="mb-2">
                {emailSending && (
                  <span className="text-yellow-200 text-sm">Sending session link to {clientData.clientEmail}...</span>
                )}
                {emailSent && (
                  <span className="text-green-300 text-sm">Session link emailed to {clientData.clientEmail}!</span>
                )}
                {emailError && (
                  <span className="text-red-300 text-sm">Failed to send email: {emailError}</span>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="rounded-md bg-green-500 px-4 py-2 text-white shadow transition-transform hover:scale-105"
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