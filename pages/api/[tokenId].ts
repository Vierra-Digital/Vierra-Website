import { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { getSessionData, SessionData } from "@/lib/sessionStore"

interface TokenDetailsResponse {
  originalFilename: string
  coordinates: SessionData["coordinates"]
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenDetailsResponse | { message: string } | Buffer>
) {
  const { tokenId, content } = req.query

  if (typeof tokenId !== "string") {
    return res.status(400).json({ message: "Invalid token." })
  }

  const session = getSessionData(tokenId)

  if (!session) {
    return res.status(404).json({ message: "Session not found." })
  }

  if (req.method === "GET") {
    if (content === "pdf") {
      const pdfFilePath = session.pdfPath

      if (!pdfFilePath) {
        console.error(`[API ${tokenId}] PDF path missing in session data.`)
        return res
          .status(500)
          .json({ message: "PDF path configuration error." })
      }

      console.log(
        `[API ${tokenId}] Attempting to serve PDF from path: ${pdfFilePath}`
      )

      if (!fs.existsSync(pdfFilePath)) {
        console.error(
          `[API ${tokenId}] PDF file not found at path: ${pdfFilePath}`
        )
        return res
          .status(404)
          .json({ message: "Signing document not found or expired." })
      }
      try {
        const stat = fs.statSync(pdfFilePath)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${session.originalFilename || "document.pdf"}"`
        )
        res.setHeader("Content-Length", stat.size.toString())
        const readStream = fs.createReadStream(pdfFilePath)
        readStream.pipe(res)
        readStream.on("error", (err) => {
          console.error(`[API ${tokenId}] Error streaming PDF:`, err)
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming PDF file." })
          } else {
            res.end()
          }
        })
        req.on("close", () => {
          console.log(
            `[API ${tokenId}] Client closed connection during PDF stream.`
          )
          readStream.destroy()
        })
      } catch (err) {
        console.error(
          `[API ${tokenId}] Error accessing PDF stats or creating stream:`,
          err
        )
        if (!res.headersSent) {
          res.status(500).json({ message: "Error accessing PDF file." })
        }
      }
    } else {
      if (!session.coordinates || !session.originalFilename) {
        console.error(
          `[API ${tokenId}] Incomplete session data for JSON response:`,
          session
        )
        return res
          .status(500)
          .json({ message: "Session data configuration incomplete." })
      }
      const responseData: TokenDetailsResponse = {
        originalFilename: session.originalFilename,
        coordinates: session.coordinates,
      }
      res.setHeader(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate"
      )
      return res.status(200).json(responseData)
    }
  } else {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }
}
