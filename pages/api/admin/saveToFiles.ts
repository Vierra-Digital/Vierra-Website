import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" })

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const { tokenId, fileName, recipientType, recipientId } = req.body ?? {}
  if (!tokenId || !recipientType || !recipientId) {
    return res.status(400).json({
      message: "tokenId, recipientType, and recipientId are required.",
    })
  }
  if (recipientType !== "staff" && recipientType !== "client") {
    return res.status(400).json({
      message: "recipientType must be 'staff' or 'client'.",
    })
  }

  const name = fileName || `document-${tokenId.slice(0, 8)}.pdf`

  try {
    if (recipientType === "staff") {
      const userId = Number(recipientId)
      if (!Number.isInteger(userId)) {
        return res.status(400).json({ message: "Invalid recipientId for staff." })
      }
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res.status(404).json({ message: "Staff member not found." })
      }
      const existing = await prisma.storedFile.findFirst({
        where: { signingTokenId: tokenId, userId },
      })
      if (existing) {
        return res.status(200).json({ success: true, alreadySaved: true })
      }
      await prisma.storedFile.create({
        data: {
          name,
          signingTokenId: tokenId,
          fileType: "pdf",
          userId,
        },
      })
    } else {
      const clientId = String(recipientId)
      const client = await prisma.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return res.status(404).json({ message: "Client not found." })
      }
      const existing = await prisma.storedFile.findFirst({
        where: { signingTokenId: tokenId, clientId },
      })
      if (existing) {
        return res.status(200).json({ success: true, alreadySaved: true })
      }
      await prisma.storedFile.create({
        data: {
          name,
          signingTokenId: tokenId,
          fileType: "pdf",
          clientId,
        },
      })
    }

    return res.status(201).json({ success: true })
  } catch (e) {
    console.error("saveToFiles error", e)
    return res.status(500).json({ message: "Failed to save file." })
  }
}
