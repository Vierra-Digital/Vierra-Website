import type { NextApiRequest, NextApiResponse } from "next"
import { requireSession } from "@/lib/auth"
import fs from "fs"
import path from "path"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" })

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const tokenId = req.query.tokenId
  const preview = req.query.preview === "1" || req.query.preview === "true"
  const nameParam = req.query.name
  const filename =
    typeof nameParam === "string" && nameParam.trim()
      ? nameParam.trim().replace(/["\\]/g, "_")
      : "document.pdf"
  const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  if (!tokenId || typeof tokenId !== "string") {
    return res.status(400).json({ message: "tokenId is required." })
  }

  const pdfsDir =
    process.env.NODE_ENV === "production"
      ? path.resolve("/tmp", "signing_pdfs")
      : path.resolve(process.cwd(), "public", "signing_pdfs")
  const pdfPath = path.join(pdfsDir, `${tokenId}.pdf`)

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ message: "File not found." })
  }

  try {
    const stats = fs.statSync(pdfPath)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", stats.size)
    res.setHeader(
      "Content-Disposition",
      preview ? "inline" : `attachment; filename="${safeFilename}"`
    )
    const stream = fs.createReadStream(pdfPath)
    stream.pipe(res)
  } catch (e) {
    console.error("downloadFile error", e)
    return res.status(500).json({ message: "Failed to download file." })
  }
}
