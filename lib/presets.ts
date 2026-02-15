export interface PresetDefinition {
  id: string
  name: string
  description: string
  /** Path relative to project root, e.g. public/presets/contract.pdf */
  pdfPath: string
  originalFilename: string
}

/** Preset metadata. Field positions come from data/preset-overrides.json only. */
/** PDFs in data/presets/ are bundled with the server for Netlify compatibility. */
export const PRESETS: PresetDefinition[] = [
  {
    id: "vierra-staffing-handbook",
    name: "Vierra Staffing Handbook",
    description: "Staff handbook with rules and policies.",
    pdfPath: "data/presets/vierra-staffing-handbook.pdf",
    originalFilename: "Vierra Staffing Handbook.pdf",
  },
  {
    id: "employee-payment-details",
    name: "Employee Payment Details",
    description: "Payment details form for payroll.",
    pdfPath: "data/presets/employee-payment-details.pdf",
    originalFilename: "Payment Details Contract For Direct Deposit.pdf",
  },
  {
    id: "non-disclosure-agreement",
    name: "Non-Disclosure Agreement",
    description: "NDA contract for staff and clients.",
    pdfPath: "data/presets/non-disclosure-agreement.pdf",
    originalFilename: "Non-Disclosure Agreement.pdf",
  },
]

export function getPresetById(id: string): PresetDefinition | undefined {
  return PRESETS.find((p) => p.id === id)
}
