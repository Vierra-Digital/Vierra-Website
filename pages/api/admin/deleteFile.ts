import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" })

  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const id = req.query.id ?? (req.body && (req.body as { id?: string }).id)
  const fileId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null
  if (!fileId) {
    return res.status(400).json({ message: "File id is required." })
  }

  const rawId = (session.user as { id?: number | string })?.id
  const uid = rawId != null ? Number(rawId) : null

  try {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { userId: true, clientId: true },
    })
    if (!file) {
      return res.status(404).json({ message: "File not found." })
    }
    const isOwner = file.userId != null && uid != null && file.userId === uid
    if (!isOwner) {
      return res.status(403).json({ message: "You can only delete files saved to you." })
    }
    await prisma.storedFile.delete({ where: { id: fileId } })
    return res.status(200).json({ success: true })
  } catch (e) {
    console.error("deleteFile error", e)
    return res.status(500).json({ message: "Failed to delete file." })
  }
}
