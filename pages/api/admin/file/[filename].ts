import type { NextApiRequest, NextApiResponse } from "next"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff" && role !== "user")
    return res.status(403).json({ message: "Forbidden" })

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const tokenId = req.query.tokenId
  const preview = req.query.preview === "1" || req.query.preview === "true"
  const filenameFromPath = req.query.filename
  const nameParam =
    typeof filenameFromPath === "string"
      ? decodeURIComponent(filenameFromPath)
      : req.query.name

  if (!tokenId || typeof tokenId !== "string") {
    return res.status(400).json({ message: "tokenId is required." })
  }

  const sessionUserId = (session.user as unknown as { id?: number })?.id
  const uid = sessionUserId != null ? Number(sessionUserId) : null

  const where: { signingTokenId: string; userId?: number; clientId?: string } = { signingTokenId: tokenId }

  if (role === "user") {
    const client = await prisma.client.findUnique({
      where: { userId: uid != null && !Number.isNaN(uid) ? uid : -1 },
      select: { id: true },
    })
    if (client) {
      where.clientId = client.id
    } else {
      return res.status(404).json({ message: "File not found." })
    }
  } else if (uid != null) {
    where.userId = uid
  }

  const stored = await prisma.storedFile.findFirst({
    where,
    select: { pdfData: true, name: true },
  })

  const getSafeFilename = (fallback: string) => {
    const base =
      typeof nameParam === "string" && nameParam.trim()
        ? nameParam.trim().replace(/["\\]/g, "_")
        : fallback
    return base.endsWith(".pdf") ? base : `${base}.pdf`
  }

  const setPdfHeaders = (safeFilename: string, buffer: Buffer) => {
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", buffer.length)
    const encoded = encodeURIComponent(safeFilename)
    res.setHeader(
      "Content-Disposition",
      `${preview ? "inline" : "attachment"}; filename="${safeFilename.replace(/"/g, '\\"')}"; filename*=UTF-8''${encoded}`
    )
  }

  if (stored?.pdfData) {
    const safeFilename = getSafeFilename(stored.name || "document")
    const buffer = Buffer.from(stored.pdfData)
    setPdfHeaders(safeFilename, buffer)
    return res.send(buffer)
  }

  if (stored && !stored.pdfData) {
    const signingSession = await prisma.signingSession.findUnique({
      where: { token: tokenId },
      select: { pdfBase64: true, originalFilename: true },
    })
    if (signingSession?.pdfBase64) {
      const safeFilename = getSafeFilename(
        signingSession.originalFilename || stored.name || "document"
      )
      const buffer = Buffer.from(signingSession.pdfBase64, "base64")
      setPdfHeaders(safeFilename, buffer)
      return res.send(buffer)
    }
    return res.status(404).json({
      message: "Document not available. The signing session may have expired.",
    })
  }

  return res.status(404).json({ message: "File not found." })
}
