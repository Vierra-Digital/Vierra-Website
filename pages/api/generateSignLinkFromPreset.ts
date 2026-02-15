import type { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { requireSession } from "@/lib/auth"
import { saveSessionData } from "@/lib/sessionStore"
import { getPresetById } from "@/lib/presets"
import { getPresetFieldsOverride } from "@/lib/presetOverrides"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const session = await requireSession(req, res)
  if (!session) return res.status(401).json({ message: "Not authenticated" })
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff")
    return res.status(403).json({ message: "Forbidden" })

  const presetId =
    typeof req.body?.presetId === "string"
      ? req.body.presetId.trim()
      : null

  if (!presetId) {
    return res.status(400).json({ message: "presetId is required." })
  }

  const preset = getPresetById(presetId)
  if (!preset) {
    return res.status(404).json({ message: "Preset not found." })
  }

  const fields = getPresetFieldsOverride(presetId)
  if (!fields || fields.length === 0) {
    return res.status(400).json({
      message: `Preset "${preset.name}" has no saved field configuration. Add fields in data/preset-overrides.json.`,
    })
  }

  const pdfFullPath = path.join(process.cwd(), preset.pdfPath)
  if (!fs.existsSync(pdfFullPath)) {
    return res.status(503).json({
      message: `This preset is not available. The PDF file for "${preset.name}" has not been added to this deployment.`,
    })
  }

  const pdfContent = fs.readFileSync(pdfFullPath)
  const pdfBase64 = pdfContent.toString("base64")
  const tokenId = uuidv4()

  await saveSessionData(tokenId, {
    token: tokenId,
    originalFilename: preset.originalFilename,
    pdfPath: "",
    pdfBase64,
    fields,
    status: "pending",
    createdAt: Date.now(),
  })

  return res.status(200).json({ link: `/sign/${tokenId}` })
}
