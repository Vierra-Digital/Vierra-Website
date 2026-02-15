import type { NextApiRequest, NextApiResponse } from "next"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  const sessionUserId = (session.user as unknown as { id?: number })?.id
  const uid = sessionUserId != null ? Number(sessionUserId) : null

  // Try database first (persistent storage; works on serverless)
  const where: { signingTokenId: string; userId?: number } = { signingTokenId: tokenId }
  if (role === "staff" && uid != null) where.userId = uid

  const stored = await prisma.storedFile.findFirst({
    where,
    select: { pdfData: true },
  })

  if (stored?.pdfData) {
    const buffer = Buffer.from(stored.pdfData)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", buffer.length)
    res.setHeader(
      "Content-Disposition",
      preview ? "inline" : `attachment; filename="${safeFilename}"`
    )
    return res.send(buffer)
  }

  // Not yet signed: serve original PDF from signing session
  if (stored && !stored.pdfData) {
    const signingSession = await prisma.signingSession.findUnique({
      where: { token: tokenId },
      select: { pdfBase64: true },
    })
    if (signingSession?.pdfBase64) {
      const buffer = Buffer.from(signingSession.pdfBase64, "base64")
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Length", buffer.length)
      res.setHeader(
        "Content-Disposition",
        preview ? "inline" : `attachment; filename="${safeFilename}"`
      )
      return res.send(buffer)
    }
    return res.status(404).json({
      message: "Document not available. The signing session may have expired.",
    })
  }

  return res.status(404).json({ message: "File not found." })
}
