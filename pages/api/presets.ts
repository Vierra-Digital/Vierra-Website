import type { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { requireRole } from "@/lib/auth"
import { PRESETS } from "@/lib/presets"

function presetPdfExists(preset: { pdfPath: string }): boolean {
  const cwd = process.cwd()
  const pathsToTry = [
    path.join(cwd, preset.pdfPath),
    path.join(cwd, preset.pdfPath.replace("data/presets/", "public/presets/")),
  ]
  return pathsToTry.some((p) => fs.existsSync(p))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const session = await requireRole(req, res, ["admin", "staff"])
  if (!session) return

  const list = PRESETS.filter((p) => presetPdfExists(p)).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }))

  return res.status(200).json(list)
}
