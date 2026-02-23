import type { NextApiRequest, NextApiResponse } from "next"
import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { prisma } from "@/lib/prisma"
import { saveSessionData } from "@/lib/sessionStore"
import { getPresetById } from "@/lib/presets"
import { getPresetFieldsOverride } from "@/lib/presetOverrides"
import { parse as parseCookie } from "cookie"

const NDA_PRESET_ID = "non-disclosure-agreement"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const { onboardingToken } = req.body ?? {}
  if (!onboardingToken) {
    return res.status(400).json({ message: "onboardingToken is required." })
  }

  const cookies = parseCookie(req.headers.cookie || "")
  if (cookies.ob_session !== onboardingToken) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const session = await prisma.onboardingSession.findUnique({
    where: { id: onboardingToken },
    include: { client: true },
  })
  if (!session || !session.client) {
    return res.status(404).json({ message: "Onboarding session not found." })
  }

  const preset = getPresetById(NDA_PRESET_ID)
  if (!preset) {
    return res.status(500).json({ message: "NDA preset not configured." })
  }

  const fields = getPresetFieldsOverride(NDA_PRESET_ID)
  if (!fields || fields.length === 0) {
    return res.status(500).json({ message: "NDA preset has no field configuration." })
  }

  const cwd = process.cwd()
  const pathsToTry = [
    path.join(cwd, preset.pdfPath),
    path.join(cwd, preset.pdfPath.replace("data/presets/", "public/presets/")),
  ]
  const pdfFullPath = pathsToTry.find((p) => fs.existsSync(p))
  if (!pdfFullPath) {
    return res.status(503).json({ message: "NDA PDF file not available in this deployment." })
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

  await prisma.storedFile.create({
    data: {
      name: preset.originalFilename,
      signingTokenId: tokenId,
      fileType: "pdf",
      clientId: session.client.id,
    },
  })

  return res.status(200).json({
    link: `/sign/${tokenId}`,
    tokenId,
  })
}
