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

const pdfsDir = path.resolve(process.cwd(), "public", "signing_pdfs")
console.log(`[generate-sign-link] Resolved pdfsDir: ${pdfsDir}`) // Log the resolved path

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
    console.log("[generate-sign-link] Parsing form data...")
    const [fields, files] = await form.parse(req)
    console.log("[generate-sign-link] Form data parsed.")

    const pdfFile = files.pdf?.[0]
    tempPdfPath = pdfFile?.filepath ?? null
    const coordsString = fields.coords?.[0]
    console.log(`[generate-sign-link] Temp PDF path: ${tempPdfPath}`)
    console.log(
      `[generate-sign-link] Coords string: ${
        coordsString ? "Received" : "Missing"
      }`
    )

    if (!pdfFile || !coordsString) {
      console.error(
        "[generate-sign-link] Error: Missing PDF file or coordinates."
      )
      return res
        .status(400)
        .json({ message: "Missing PDF file or coordinates." })
    }

    if (pdfFile.mimetype !== "application/pdf") {
      console.error(
        `[generate-sign-link] Error: Invalid file type - ${pdfFile.mimetype}`
      )
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        console.log(
          `[generate-sign-link] Cleaning up temp file due to invalid type: ${tempPdfPath}`
        )
        fs.unlinkSync(tempPdfPath)
      }
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
      console.log("[generate-sign-link] Coordinates parsed successfully.")
    } catch (parseError) {
      console.error(
        "[generate-sign-link] Error parsing coordinates:",
        parseError
      )
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        console.log(
          `[generate-sign-link] Cleaning up temp file due to coord parse error: ${tempPdfPath}`
        )
        fs.unlinkSync(tempPdfPath)
      }
      return res.status(400).json({ message: "Invalid coordinates format." })
    }

    const tokenId = uuidv4()
    const originalFilename = pdfFile.originalFilename || "document.pdf"
    persistentPdfPath = path.join(pdfsDir, `${tokenId}.pdf`)
    publicPdfPath = `/signing_pdfs/${tokenId}.pdf`
    console.log(`[generate-sign-link] Generated tokenId: ${tokenId}`)
    console.log(
      `[generate-sign-link] Persistent PDF path: ${persistentPdfPath}`
    )
    console.log(`[generate-sign-link] Public PDF path: ${publicPdfPath}`)

    // Check and create directory
    try {
      if (!fs.existsSync(pdfsDir)) {
        console.log(
          `[generate-sign-link] pdfsDir does not exist. Creating: ${pdfsDir}`
        )
        fs.mkdirSync(pdfsDir, { recursive: true })
        console.log(`[generate-sign-link] pdfsDir created successfully.`)
      } else {
        console.log(`[generate-sign-link] pdfsDir already exists: ${pdfsDir}`)
      }
    } catch (dirError) {
      console.error(
        `[generate-sign-link] Error checking/creating pdfsDir (${pdfsDir}):`,
        dirError
      )
      throw new Error(
        `Failed to ensure PDF directory exists. Details: ${
          dirError instanceof Error ? dirError.message : String(dirError)
        }`
      )
    }

    // Rename (move) the file
    if (tempPdfPath) {
      try {
        console.log(
          `[generate-sign-link] Attempting to rename ${tempPdfPath} to ${persistentPdfPath}`
        )
        fs.renameSync(tempPdfPath, persistentPdfPath)
        console.log(`[generate-sign-link] File renamed successfully.`)
      } catch (renameError) {
        console.error(
          `[generate-sign-link] Error renaming file from ${tempPdfPath} to ${persistentPdfPath}:`,
          renameError
        )
        throw new Error(
          `Failed to save PDF file. Details: ${
            renameError instanceof Error
              ? renameError.message
              : String(renameError)
          }`
        )
      }
    } else {
      console.error(
        "[generate-sign-link] Error: Temporary PDF path is null before rename."
      )
      throw new Error("Temporary PDF path is null.")
    }
    // Temporary PDF path is now null after renaming
    tempPdfPath = null

    const sessionData: SessionData = {
      token: tokenId,
      originalFilename: originalFilename,
      pdfPath: publicPdfPath,
      coordinates: coords,
      status: "pending",
      createdAt: Date.now(),
    }

    try {
      console.log(
        `[generate-sign-link] Saving session data for token: ${tokenId}`
      )
      saveSessionData(tokenId, sessionData)
      console.log(`[generate-sign-link] Session data saved successfully.`)
    } catch (sessionError) {
      console.error(
        `[generate-sign-link] Error saving session data for token ${tokenId}:`,
        sessionError
      )
      throw new Error(
        `Failed to save session data. Details: ${
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError)
        }`
      )
    }

    console.log(
      `[generate-sign-link] Sending success response for token: ${tokenId}`
    )
    res.status(200).json({ link: `https://vierradev.com/sign/${tokenId}` })
  } catch (error: unknown) {
    console.error("[generate-sign-link] Caught error in main try block:", error)

    if (error instanceof Error) {
      if (persistentPdfPath && fs.existsSync(persistentPdfPath)) {
        try {
          console.log(
            `[generate-sign-link] Cleaning up persistent PDF: ${persistentPdfPath}`
          )
          fs.unlinkSync(persistentPdfPath)
        } catch (cleanupError) {
          console.error(
            `[generate-sign-link] Error cleaning up PDF ${persistentPdfPath}:`,
            cleanupError
          )
        }
      }
      const tempPathToClean =
        (error.message?.includes("Failed to save PDF file") ||
          error.message?.includes("Temporary PDF path is null")) &&
        tempPdfPath
          ? tempPdfPath
          : null

      if (tempPathToClean && fs.existsSync(tempPathToClean)) {
        try {
          console.log(
            `[generate-sign-link] Cleaning up temp PDF (error path): ${tempPathToClean}`
          )
          fs.unlinkSync(tempPathToClean)
        } catch (cleanupError) {
          console.error(
            `[generate-sign-link] Error cleaning up temp PDF ${tempPathToClean}:`,
            cleanupError
          )
        }
      }

      const message = error.message?.includes("Failed to save session data")
        ? "Failed to save signing session metadata."
        : error.message?.includes("Failed to save PDF file")
        ? "Failed to save uploaded PDF file."
        : error.message?.includes("Failed to ensure PDF directory exists")
        ? "Server configuration error creating storage directory."
        : "Failed to process PDF upload."
      console.error(
        `[generate-sign-link] Sending 500 response with message: ${message}`
      )
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
