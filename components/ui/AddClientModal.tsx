import React, { useState, useRef, useEffect } from "react";
import { Bricolage_Grotesque as BricolageGrotesqueFont, Inter as InterFont } from "next/font/google";
import { X } from "lucide-react";
import type { SessionItem } from "@/types/session";

const Bricolage_Grotesque = BricolageGrotesqueFont({ subsets: ["latin"] });
const inter = InterFont({ subsets: ["latin"] });

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (row: SessionItem) => void;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [step, setStep] = useState(1);
  const [clientData, setClientData] = useState({ clientName: "", clientEmail: "", businessName: "" });
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>(""); // SSR-safe origin
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // Reset form when reopened
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
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const payload = {
        clientName: clientData.clientName.trim(),
        clientEmail: clientData.clientEmail.trim().toLowerCase(),
        businessName: clientData.businessName.trim(),
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
    // When sessionLink is set, send email
    if (step === 3 && sessionLink && clientData.clientEmail) {
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

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Combine all form data
      const allFormData = {
        ...clientData,
      };

      const response = await fetch("/api/onboarding/saveAnswers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sessionLink?.split("/").pop() || "",
          answers: allFormData,
          completed: true,
        }),
      });

      if (response.ok) {
        setShowSuccessModal(true);
      } else {
        console.error("Failed to save answers");
        setShowSuccessModal(true); 
      }
    } catch (err) {
      console.error("Error saving answers:", err);
      setShowSuccessModal(true); 
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleOutsideClick}>
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-lg bg-[#2E0A4F] p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
      >
        <button
          className="absolute right-4 top-4 z-10 text-gray-400 transition-colors hover:text-red-500"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <h2 id="add-client-title" className={`mb-5 text-center text-2xl font-bold ${Bricolage_Grotesque.className}`}>
          Add New Client
        </h2>

        {err && <div className="mb-4 rounded bg-red-500/20 p-2 text-sm text-red-100">{err}</div>}

        {step === 1 && (
          <>
            <h3 className={`mb-3 text-lg font-semibold ${Bricolage_Grotesque.className}`}>Client Information</h3>

            <div className="mb-4">
              <label htmlFor="clientName" className={`block text-sm font-medium ${inter.className}`}>
                Client Name
              </label>
              <input
                type="text"
                id="clientName"
                name="clientName"
                value={clientData.clientName}
                onChange={handleChange}
                className={`mt-1 w-full rounded border border-[#701CC0]/50 bg-[#18042A]/50 p-2 text-white ${inter.className}`}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="clientEmail" className={`block text-sm font-medium ${inter.className}`}>
                Client Email
              </label>
              <input
                type="email"
                id="clientEmail"
                name="clientEmail"
                value={clientData.clientEmail}
                onChange={handleChange}
                className={`mt-1 w-full rounded border border-[#701CC0]/50 bg-[#18042A]/50 p-2 text-white ${inter.className}`}
              />
              {!emailValid && clientData.clientEmail && (
                <p className="mt-1 text-xs text-amber-200">Please enter a valid email.</p>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="businessName" className={`block text-sm font-medium ${inter.className}`}>
                Business Name
              </label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                value={clientData.businessName}
                onChange={handleChange}
                className={`mt-1 w-full rounded border border-[#701CC0]/50 bg-[#18042A]/50 p-2 text-white ${inter.className}`}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className={`rounded-md bg-purple-500 px-4 py-2 text-white shadow transition-transform hover:scale-105 ${Bricolage_Grotesque.className}`}
                onClick={nextStep}
                disabled={
                  !clientData.clientName.trim() ||
                  !clientData.clientEmail.trim() ||
                  !emailValid ||
                  !clientData.businessName.trim()
                }
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className={`mb-3 text-lg font-semibold ${Bricolage_Grotesque.className}`}>Confirm Details</h3>
            <p className={`mb-2 ${inter.className}`}>Client Name: {clientData.clientName}</p>
            <p className={`mb-2 ${inter.className}`}>Client Email: {clientData.clientEmail}</p>
            <p className={`mb-2 ${inter.className}`}>Business Name: {clientData.businessName}</p>

            <div className="mt-6 flex justify-between">
              <button
                className={`rounded-md bg-gray-300 px-4 py-2 text-black shadow transition-transform hover:scale-105 ${inter.className}`}
                onClick={prevStep}
              >
                Previous
              </button>
              <button
                className={`rounded-md bg-green-500 px-4 py-2 text-white shadow transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${Bricolage_Grotesque.className}`}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Generating…" : "Generate Session Link"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className={`mb-3 text-lg font-semibold ${Bricolage_Grotesque.className}`}>Session Link Generated</h3>
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
              {/* Email sending status */}
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
                className={`rounded-md bg-green-500 px-4 py-2 text-white shadow transition-transform hover:scale-105 ${Bricolage_Grotesque.className}`}
                onClick={handleFinish}
                disabled={loading}
              >
                {loading ? "Saving..." : "Finish and Save"}
              </button>
            </div>
          </>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="rounded-lg bg-white p-6 text-center">
              <h3 className="mb-4 text-lg font-semibold">Success!</h3>
              <p className="mb-4 text-sm text-gray-700">
                Client information and session link have been successfully saved.
              </p>
              <button
                className="rounded-md bg-green-500 px-4 py-2 text-white transition-transform hover:scale-105"
                onClick={() => {
                  setShowSuccessModal(false);
                  onClose();
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddClientModal;