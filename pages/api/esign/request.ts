import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { saveSessionData, type PdfField } from "@/lib/sessionStore";

/**
 * E-signature via the in-house signer system: create a SigningSession for a PDF and return a
 * /sign/<token> link to drop into an email. The recipient signs at that link (existing
 * pages/sign/[tokenId] UI → /api/submitSignature), which stamps the PDF and emails the signed
 * copy back. This reuses the same SigningSession/SignedDocument pipeline as the NDA/onboarding
 * flow rather than a separate stamp-locally path. See docs/ESIGNATURE_PLAN.md.
 *
 * Body: { pdfBase64, filename, signerEmail? }
 * A default signature + date field is placed near the bottom of the last page; precise
 * field placement is a later enhancement (would reuse the admin field-placement UI).
 */
export const config = { api: { bodyParser: { sizeLimit: "12mb" } } };

function decodeBase64Maybe(input: string): Buffer {
  const comma = input.indexOf(",");
  const raw = input.startsWith("data:") && comma >= 0 ? input.slice(comma + 1) : input;
  return Buffer.from(raw, "base64");
}

export default withAuth(
  async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const pdfBase64 = asStr(body.pdfBase64);
    const filename = asStr(body.filename) || "document.pdf";
    const signerEmail = asStr(body.signerEmail) || undefined;
    if (!pdfBase64) {
      res.status(400).json({ message: "pdfBase64 is required." });
      return;
    }

    let pageCount: number;
    try {
      const doc = await PDFDocument.load(decodeBase64Maybe(pdfBase64));
      pageCount = doc.getPageCount();
      if (pageCount < 1) throw new Error("PDF has no pages.");
    } catch (e) {
      res.status(422).json({ message: `Could not read this PDF: ${e instanceof Error ? e.message : "invalid file"}` });
      return;
    }

    const token = randomUUID();
    // xRatio/yRatio are fractions of the page (yRatio measured from the top); width/height are
    // in PDF points (matches submitSignature's embedding math).
    const fields: PdfField[] = [
      { type: "signature", page: pageCount, xRatio: 0.55, yRatio: 0.84, width: 180, height: 56, id: "sig-1" },
      { type: "date", page: pageCount, xRatio: 0.55, yRatio: 0.93, width: 120, height: 22, id: "date-1" },
    ];

    await saveSessionData(token, {
      token,
      originalFilename: filename,
      pdfPath: "",
      pdfBase64: pdfBase64.startsWith("data:") ? decodeBase64Maybe(pdfBase64).toString("base64") : pdfBase64,
      fields,
      status: "pending",
      createdAt: Date.now(),
      signerEmail,
    });

    res.status(200).json({ token, link: `/sign/${token}` });
  },
  { methods: ["POST"] }
);
