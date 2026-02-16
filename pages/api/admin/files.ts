import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth"

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

  const { filter } = req.query
  // filter: "me" | userId | clientId - optional; when omitted, default to current user only (privacy)

  try {
    const rawId = (session.user as { id?: number | string })?.id
    const uid = rawId != null ? Number(rawId) : undefined

    const where: { userId?: number; clientId?: string } = {}

    // Client users (role "user") only see files linked to their client
    if (role === "user") {
      const client = await prisma.client.findUnique({
        where: { userId: uid != null && !Number.isNaN(uid) ? uid : -1 },
        select: { id: true },
      })
      if (client) {
        where.clientId = client.id
      } else {
        where.clientId = "__none__"
      }
    } else if (filter === "me" || !filter) {
      if (uid != null && !Number.isNaN(uid)) {
        where.userId = uid
      } else {
        where.userId = -1
      }
    } else if (filter && typeof filter === "string") {
      const num = Number(filter)
      if (!Number.isNaN(num)) {
        where.userId = num
      } else {
        where.clientId = filter
      }
    }

    const files = await prisma.storedFile.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileType: true,
        signingTokenId: true,
        createdAt: true,
        userId: true,
        clientId: true,
        user: { select: { name: true } },
        client: { select: { name: true } },
      },
    })

    const rows = files.map((f) => {
      const d = f.createdAt
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      const yyyy = d.getFullYear()
      return {
        id: f.id,
        name: f.name,
        date: `${mm}/${dd}/${yyyy}`,
        fileType: f.fileType,
        signingTokenId: f.signingTokenId,
        owner: f.user?.name ?? f.client?.name ?? "Unknown",
      }
    })

    return res.status(200).json(rows)
  } catch (e) {
    console.error("admin/files GET", e)
    return res.status(500).json({ message: "Failed to load files." })
  }
}
