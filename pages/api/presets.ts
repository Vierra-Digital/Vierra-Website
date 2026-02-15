import type { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { requireSession } from "@/lib/auth"
import { PRESETS } from "@/lib/presets"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" })

  const list = PRESETS.filter((p) => {
    const fullPath = path.join(process.cwd(), p.pdfPath)
    return fs.existsSync(fullPath)
  }).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }))

  return res.status(200).json(list)
}
