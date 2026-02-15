import fs from "fs"
import path from "path"
import type { PdfField } from "@/lib/sessionStore"

const OVERRIDES_PATH = path.join(process.cwd(), "data", "preset-overrides.json")

type OverridesFile = Record<string, { fields: PdfField[] }>

function readOverrides(): OverridesFile {
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, "utf-8")
    const parsed = JSON.parse(raw) as OverridesFile
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function getPresetFieldsOverride(presetId: string): PdfField[] | null {
  const overrides = readOverrides()
  const preset = overrides[presetId]
  if (preset?.fields && Array.isArray(preset.fields) && preset.fields.length > 0) {
    return preset.fields
  }
  return null
}
