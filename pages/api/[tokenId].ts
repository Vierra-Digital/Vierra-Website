import { NextApiRequest, NextApiResponse } from "next"
import { getSessionData, SessionData } from "@/lib/sessionStore"

interface TokenDetailsResponse {
  originalFilename: string
  coordinates: SessionData["coordinates"]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TokenDetailsResponse | { message: string } | Buffer>
) {
  const { tokenId, content } = req.query

  if (typeof tokenId !== "string") {
    return res.status(400).json({ message: "Invalid token." })
  }

  const session = await getSessionData(tokenId)

  if (!session) {
    return res.status(404).json({ message: "Session not found." })
  }

  if (req.method === "GET") {
    if (content === "pdf") {
      if (!session.pdfBase64) {
        return res.status(404).json({ message: "PDF not available." })
      }
      try {
        const buffer = Buffer.from(session.pdfBase64, "base64")
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${session.originalFilename}"`
        )
        res.setHeader("Content-Length", buffer.length.toString())
        return res.send(buffer)
      } catch (err) {
        console.error(`[API ${tokenId}] Error serving PDF:`, err)
        if (!res.headersSent) {
          return res.status(500).json({ message: "Error serving PDF file." })
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
