import { NextApiRequest, NextApiResponse } from "next"
import formidable from "formidable"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { SessionData, saveSessionData } from "@/lib/sessionStore"

export const config = {
  api: {
    bodyParser: false,
  },
}

// Update directory path for production environment compatibility
const pdfsDir = process.env.NODE_ENV === 'production'
  ? path.resolve('/tmp', "signing_pdfs")
  : path.resolve(process.cwd(), "public", "signing_pdfs")

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
  let persistentPdfPath: string | null = null
  let publicPdfPath: string | null = null

  try {
    const [fields, files] = await form.parse(req)

    const pdfFile = files.pdf?.[0]
    tempPdfPath = pdfFile?.filepath ?? null
    const coordsString = fields.coords?.[0]

    if (!pdfFile || !coordsString) {
      return res
        .status(400)
        .json({ message: "Missing PDF file or coordinates." })
    }

    if (pdfFile.mimetype !== "application/pdf") {
      if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath)
      return res
        .status(400)
        .json({ message: "Invalid file type. Only PDF is allowed." })
    }

    let coords
    try {
      coords = JSON.parse(coordsString)
      if (
        typeof coords.page !== "number" ||
        typeof coords.xRatio !== "number" ||
        typeof coords.yRatio !== "number" ||
        typeof coords.width !== "number" ||
        typeof coords.height !== "number"
      ) {
        throw new Error("Invalid coordinate format.")
      }
    } catch {
      if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath)
      return res.status(400).json({ message: "Invalid coordinates format." })
    }

    const tokenId = uuidv4()
    const originalFilename = pdfFile.originalFilename || "document.pdf"

    // Check that tempPdfPath is not null before reading
    if (!tempPdfPath) {
      throw new Error("Temporary PDF path is null.")
    }

    // Read PDF file as base64
    const pdfContent = fs.readFileSync(tempPdfPath);
    const pdfBased64 = pdfContent.toString('base64');

    persistentPdfPath = path.join(pdfsDir, `${tokenId}.pdf`)
    // Adjust path handling based on environment
    publicPdfPath = process.env.NODE_ENV === 'production'
      ? `/tmp/signing_pdfs/${tokenId}.pdf`
      : `/signing_pdfs/${tokenId}.pdf`

    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true })
    }

    if (tempPdfPath) {
      fs.renameSync(tempPdfPath, persistentPdfPath)
    } else {
      throw new Error("Temporary PDF path is null.")
    }
    tempPdfPath = null

    const sessionData: SessionData = {
      token: tokenId,
      originalFilename: originalFilename,
      pdfPath: publicPdfPath,
      pdfBase64: pdfBased64,
      coordinates: coords,
      status: "pending",
      createdAt: Date.now(),
    }

    saveSessionData(tokenId, sessionData)

    res.status(200).json({ link: `/sign/${tokenId}` })
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[generate-sign-link] Error processing PDF upload:", error)

      if (persistentPdfPath && fs.existsSync(persistentPdfPath)) {
        try {
          fs.unlinkSync(persistentPdfPath)
        } catch (cleanupError) {
          console.error(
            `[generate-sign-link] Error cleaning up PDF ${persistentPdfPath}:`,
            cleanupError
          )
        }
      }
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