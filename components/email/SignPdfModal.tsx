import React, { useCallback, useEffect, useState } from "react";
import { FiX, FiUpload } from "react-icons/fi";
import { GLASS_MODAL, GLASS_SCRIM } from "@/components/email/emailTheme";

/**
 * "Request signature" modal — creates a signing session for a PDF via the in-house signer
 * system (/api/esign/request → SigningSession) and hands back the /sign/<token> link to drop
 * into the email. The recipient signs at that link and the signed PDF is emailed back by the
 * existing pipeline. See docs/ESIGNATURE_PLAN.md.
 */
type PdfCandidate = { id: string; filename: string; contentBase64: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the absolute signing URL + filename once the session is created. */
  onLinkReady: (url: string, filename: string) => void;
  /** PDF attachments already on the compose window, offered as signing targets. */
  pdfCandidates?: PdfCandidate[];
  /** Prefill the signer's email (e.g. the current recipient). */
  defaultSignerEmail?: string;
};

const SignPdfModal: React.FC<Props> = ({ open, onClose, onLinkReady, pdfCandidates = [], defaultSignerEmail = "" }) => {
  const [pdf, setPdf] = useState<{ filename: string; base64: string } | null>(null);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setPdf(null);
    setSignerEmail(defaultSignerEmail);
    setBusy(false);
    setError("");
  }, [defaultSignerEmail]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const readFile = async (file: File) => {
    if (!/pdf$/i.test(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    setPdf({ filename: file.name, base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl });
    setError("");
  };

  const submit = async () => {
    if (busy) return;
    if (!pdf) {
      setError("Choose a PDF to send for signature.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/esign/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: pdf.base64, filename: pdf.filename, signerEmail: signerEmail.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not create the signing link.");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      onLinkReady(`${origin}${data.link}`, pdf.filename);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the signing link.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 ${GLASS_SCRIM}`} role="dialog" aria-modal="true">
      <div className={`w-full max-w-lg rounded-2xl ${GLASS_MODAL} max-h-[90vh] overflow-y-auto p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1E1B2E]">Request a signature</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-black/5" aria-label="Close">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Choose PDF */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold text-[#4A465C]">Document</p>
          {pdfCandidates.length > 0 ? (
            <div className="mb-2 space-y-1">
              {pdfCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPdf({ filename: c.filename, base64: c.contentBase64 });
                    setError("");
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    pdf?.filename === c.filename ? "border-[#701CC0] bg-[#F5EFFF] text-[#4C1D95]" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                  }`}
                >
                  {c.filename}
                </button>
              ))}
            </div>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#D6C7EC] bg-white px-3 py-2 text-sm text-[#4A465C] hover:bg-[#F9FAFB]">
            <FiUpload className="h-4 w-4" />
            {pdf && !pdfCandidates.some((c) => c.filename === pdf.filename) ? pdf.filename : "Upload a PDF"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
          </label>
        </div>

        {/* 2. Signer email (optional) */}
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold text-[#4A465C]">Signer email (optional)</p>
          <input
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="Who is signing? (they'll also get a copy)"
            className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1E1B2E] focus:outline-none focus:ring-2 focus:ring-[#701CC0]"
          />
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-medium text-[#6B7280] hover:bg-black/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center rounded-xl bg-[#701CC0] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Creating link…" : "Create signing link"}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#9A93AE]">
          A signing link is created and inserted into your message. The recipient signs it in the
          browser (signature + date on the last page), and the signed PDF is emailed back
          automatically — same secure pipeline as the onboarding documents.
        </p>
      </div>
    </div>
  );
};

export default SignPdfModal;
