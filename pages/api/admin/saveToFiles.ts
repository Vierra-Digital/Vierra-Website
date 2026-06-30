import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/withAuth"

export default withAuth(
  async (req, res, session) => {
    const { companyId } = session
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
        const userId = String(recipientId)
        if (!userId) {
          return res.status(400).json({ message: "Invalid recipientId for staff." })
        }
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
          return res.status(404).json({ message: "Staff member not found." })
        }
        const existing = await prisma.storedFile.findFirst({
          where: { signing_token_id: tokenId, user_id: userId },
        })
        if (existing) {
          return res.status(200).json({ success: true, alreadySaved: true })
        }
        await prisma.storedFile.create({
          data: {
            name,
            signing_token_id: tokenId,
            file_type: "pdf",
            user_id: userId,
            company_id: companyId,
          },
        })
      } else {
        const clientId = String(recipientId)
        const client = await prisma.client.findUnique({ where: { id: clientId } })
        if (!client) {
          return res.status(404).json({ message: "Client not found." })
        }
        const existing = await prisma.storedFile.findFirst({
          where: { signing_token_id: tokenId, client_id: clientId },
        })
        if (existing) {
          return res.status(200).json({ success: true, alreadySaved: true })
        }
        await prisma.storedFile.create({
          data: {
            name,
            signing_token_id: tokenId,
            file_type: "pdf",
            client_id: clientId,
            company_id: companyId,
          },
        })
      }

      return res.status(201).json({ success: true })
    } catch (e) {
      console.error("saveToFiles error", e)
      return res.status(500).json({ message: "Failed to save file." })
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
)
