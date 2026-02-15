import { NextApiRequest, NextApiResponse } from "next"
import formidable from "formidable"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"
import { SessionData, saveSessionData, PdfField } from "@/lib/sessionStore"

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const form = formidable({})
  let tempPdfPath: string | null = null

  try {
    const [fields, files] = await form.parse(req)

    const pdfFile = files.pdf?.[0]
    tempPdfPath = pdfFile?.filepath ?? null
    const coordsString = fields.coords?.[0]
    const fieldsString = fields.fields?.[0]

    if (!pdfFile) {
      return res
        .status(400)
        .json({ message: "Missing PDF file." })
    }

    const hasLegacyCoords = coordsString && coordsString.trim().length > 0
    const hasFields = fieldsString && fieldsString.trim().length > 0
    if (!hasLegacyCoords && !hasFields) {
      return res
        .status(400)
        .json({ message: "Missing coordinates or fields." })
    }

    if (pdfFile.mimetype !== "application/pdf") {
      if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath)
      return res
        .status(400)
        .json({ message: "Invalid file type. Only PDF is allowed." })
    }

    let fieldsData: PdfField[]
    try {
      if (hasFields) {
        const parsed = JSON.parse(fieldsString)
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("Fields must be a non-empty array.")
        }
        const hasSignature = parsed.some((f: { type?: string }) => f.type === "signature")
        if (!hasSignature) {
          if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath)
          return res.status(400).json({ message: "At least one signature field is required." })
        }
        for (const f of parsed) {
          if (!["signature", "date", "text"].includes(f.type) ||
            typeof f.page !== "number" ||
            typeof f.xRatio !== "number" ||
            typeof f.yRatio !== "number" ||
            typeof f.width !== "number" ||
            typeof f.height !== "number") {
            throw new Error("Invalid field format.")
          }
        }
        fieldsData = parsed
      } else {
        const coords = JSON.parse(coordsString!)
        if (
          typeof coords.page !== "number" ||
          typeof coords.xRatio !== "number" ||
          typeof coords.yRatio !== "number" ||
          typeof coords.width !== "number" ||
          typeof coords.height !== "number"
        ) {
          throw new Error("Invalid coordinate format.")
        }
        fieldsData = [{
          type: "signature",
          page: coords.page,
          xRatio: coords.xRatio,
          yRatio: coords.yRatio,
          width: coords.width,
          height: coords.height,
        }]
      }
    } catch {
      if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath)
      return res.status(400).json({ message: "Invalid coordinates or fields format." })
    }

    const tokenId = uuidv4()
    const originalFilename = pdfFile.originalFilename || "document.pdf"

    if (!tempPdfPath) {
      throw new Error("Temporary PDF path is null.")
    }

    const pdfContent = fs.readFileSync(tempPdfPath);
    const pdfBase64 = pdfContent.toString('base64');

    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }
    tempPdfPath = null;

    const sessionData: SessionData = {
      token: tokenId,
      originalFilename: originalFilename,
      pdfPath: "",
      pdfBase64,
      fields: fieldsData,
      status: "pending",
      createdAt: Date.now(),
    }

    await saveSessionData(tokenId, sessionData)

    res.status(200).json({ link: `/sign/${tokenId}` })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[generate-sign-link] Error processing PDF upload:", error)

      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath)
        } catch (cleanupError) {
          console.error(
            `[generate-sign-link] Error cleaning up temp PDF ${tempPdfPath}:`,
            cleanupError
          )
        }
      }
      const message = error.message?.includes("Failed to save session data")
        ? "Failed to save signing session metadata."
        : "Failed to process PDF upload."
      res.status(500).json({ message })
    } else {
      console.error(
        "[generate-sign-link] Unknown error processing PDF upload:",
        error
      )
      res
        .status(500)
        .json({ message: "An unknown error occurred during PDF upload." })
    }
  }
}