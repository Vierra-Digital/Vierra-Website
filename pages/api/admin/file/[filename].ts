import type { NextApiRequest, NextApiResponse } from "next"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx"
import * as XLSX from "xlsx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

function cellToText(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function wrapCellText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
  maxLines: number
) {
  const source = text || ""
  if (!source) return [""]
  const words = source.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) {
      lines.push(current)
      current = word
    } else {
      lines.push(word)
      current = ""
    }
    if (lines.length >= maxLines) {
      const last = lines[maxLines - 1] || ""
      lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, Math.max(1, last.length - 3))}...` : `${last}...`
      return lines.slice(0, maxLines)
    }
  }

  if (current) {
    lines.push(current)
  }
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines)
  }
  return lines
}

async function convertXlsxToPdfBuffer(xlsxBuffer: Buffer, title: string) {
  const workbook = XLSX.read(xlsxBuffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error("Spreadsheet is empty")
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  })

  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 842
  const pageHeight = 595
  const marginX = 28
  const marginY = 28
  const titleSize = 15
  const bodyFontSize = 8
  const headerFontSize = 8
  const lineHeight = 10
  const cellPaddingX = 4
  const cellPaddingY = 3
  const maxCellLines = 4
  const tableTopOffset = 30

  let page = pdf.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - marginY
  page.drawText(title || "Contacts", {
    x: marginX,
    y: cursorY,
    size: titleSize,
    font: bold,
  })
  cursorY -= tableTopOffset

  const normalizedRows = (rows || []).map((row) => (Array.isArray(row) ? row.map(cellToText) : []))
  const columnCount = Math.max(1, ...normalizedRows.map((row) => row.length), 1)
  const tableWidth = pageWidth - marginX * 2
  const columnWidth = tableWidth / columnCount
  const headerRow = normalizedRows[0] || []

  const drawHeader = () => {
    const headerHeight = lineHeight + cellPaddingY * 2
    page.drawRectangle({
      x: marginX,
      y: cursorY - headerHeight + 1,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.95, 0.96, 0.99),
    })

    for (let c = 0; c < columnCount; c += 1) {
      const x = marginX + c * columnWidth
      page.drawRectangle({
        x,
        y: cursorY - headerHeight + 1,
        width: columnWidth,
        height: headerHeight,
        borderColor: rgb(0.82, 0.84, 0.90),
        borderWidth: 0.6,
      })
      const text = headerRow[c] || `Column ${c + 1}`
      const trimmed =
        bold.widthOfTextAtSize(text, headerFontSize) > columnWidth - cellPaddingX * 2
          ? `${text.slice(0, Math.max(1, Math.floor(text.length * 0.75)))}...`
          : text
      page.drawText(trimmed, {
        x: x + cellPaddingX,
        y: cursorY - headerFontSize - cellPaddingY,
        size: headerFontSize,
        font: bold,
      })
    }
    cursorY -= headerHeight
  }

  drawHeader()

  for (let rowIndex = 1; rowIndex < normalizedRows.length; rowIndex += 1) {
    const row = normalizedRows[rowIndex]
    const wrappedByColumn = Array.from({ length: columnCount }).map((_, c) =>
      wrapCellText(row[c] || "", columnWidth - cellPaddingX * 2, regular, bodyFontSize, maxCellLines)
    )
    const rowLineCount = Math.max(1, ...wrappedByColumn.map((lines) => lines.length))
    const rowHeight = rowLineCount * lineHeight + cellPaddingY * 2

    if (cursorY - rowHeight < marginY) {
      page = pdf.addPage([pageWidth, pageHeight])
      cursorY = pageHeight - marginY
      drawHeader()
    }

    for (let c = 0; c < columnCount; c += 1) {
      const x = marginX + c * columnWidth
      const y = cursorY - rowHeight
      page.drawRectangle({
        x,
        y,
        width: columnWidth,
        height: rowHeight,
        borderColor: rgb(0.86, 0.88, 0.92),
        borderWidth: 0.5,
      })
      const lines = wrappedByColumn[c]
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
        page.drawText(lines[lineIdx] || "", {
          x: x + cellPaddingX,
          y: cursorY - cellPaddingY - bodyFontSize - lineIdx * lineHeight,
          size: bodyFontSize,
          font: regular,
          color: rgb(0.20, 0.22, 0.27),
        })
      }
    }

    cursorY -= rowHeight
  }

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

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

  const tokenId = req.query.tokenId
  const preview = req.query.preview === "1" || req.query.preview === "true"
  const filenameFromPath = req.query.filename
  const nameParam =
    typeof filenameFromPath === "string"
      ? decodeURIComponent(filenameFromPath)
      : req.query.name

  if (!tokenId || typeof tokenId !== "string") {
    return res.status(400).json({ message: "tokenId is required." })
  }

  const sessionUserId = (session.user as unknown as { id?: number })?.id
  const uid = sessionUserId != null ? Number(sessionUserId) : null
  if (uid != null && !Number.isNaN(uid) && tokenId.startsWith(`contacts-xlsx:${uid}`)) {
    await syncContactsSpreadsheetForUser({ userId: uid })
  }

  const where: { signingTokenId: string; userId?: number; clientId?: string } = { signingTokenId: tokenId }

  if (role === "user") {
    const client = await prisma.client.findUnique({
      where: { userId: uid != null && !Number.isNaN(uid) ? uid : -1 },
      select: { id: true },
    })
    if (client) {
      where.clientId = client.id
    } else {
      return res.status(404).json({ message: "File not found." })
    }
  } else if (uid != null) {
    where.userId = uid
  }

  const stored = await prisma.storedFile.findFirst({
    where,
    select: { pdfData: true, name: true, fileType: true },
  })

  const getSafeFilename = (fallback: string, fileType = "pdf") => {
    const base =
      typeof nameParam === "string" && nameParam.trim()
        ? nameParam.trim().replace(/["\\]/g, "_")
        : fallback
    const ext = fileType.toLowerCase() === "xlsx" ? ".xlsx" : ".pdf"
    return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`
  }

  const setFileHeaders = (safeFilename: string, buffer: Buffer, fileType = "pdf") => {
    const contentType =
      fileType.toLowerCase() === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Length", buffer.length)
    const encoded = encodeURIComponent(safeFilename)
    res.setHeader(
      "Content-Disposition",
      `${preview ? "inline" : "attachment"}; filename="${safeFilename.replace(/"/g, '\\"')}"; filename*=UTF-8''${encoded}`
    )
  }

  if (stored?.pdfData) {
    const sourceBuffer = Buffer.from(stored.pdfData)
    const storedFileType = (stored.fileType || "pdf").toLowerCase()
    if (preview && storedFileType === "xlsx") {
      try {
        const pdfBuffer = await convertXlsxToPdfBuffer(sourceBuffer, stored.name || "Contacts")
        const pdfName = (stored.name || "document").replace(/\.xlsx$/i, ".pdf")
        const safePdfName = getSafeFilename(pdfName, "pdf")
        setFileHeaders(safePdfName, pdfBuffer, "pdf")
        return res.send(pdfBuffer)
      } catch {
        // If conversion fails, fall back to raw file output.
      }
    }
    const safeFilename = getSafeFilename(stored.name || "document", stored.fileType || "pdf")
    setFileHeaders(safeFilename, sourceBuffer, stored.fileType || "pdf")
    return res.send(sourceBuffer)
  }

  if (stored && !stored.pdfData) {
    const signingSession = await prisma.signingSession.findUnique({
      where: { token: tokenId },
      select: { pdfBase64: true, originalFilename: true },
    })
    if (signingSession?.pdfBase64) {
      const safeFilename = getSafeFilename(signingSession.originalFilename || stored.name || "document", "pdf")
      const buffer = Buffer.from(signingSession.pdfBase64, "base64")
      setFileHeaders(safeFilename, buffer, "pdf")
      return res.send(buffer)
    }
    return res.status(404).json({
      message: "Document not available. The signing session may have expired.",
    })
  }

  return res.status(404).json({ message: "File not found." })
}
