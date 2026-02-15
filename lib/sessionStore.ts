import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PdfFieldType = "signature" | "date" | "text";

export interface PdfField {
  type: PdfFieldType;
  page: number;
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
  id?: string;
}

/** @deprecated Use fields instead. Kept for backward compatibility. */
export interface LegacyCoordinates {
  page: number;
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
}

export interface SessionData {
  token: string;
  originalFilename: string;
  pdfPath: string;
  pdfBase64?: string;
  /** @deprecated Use fields instead. */
  coordinates?: LegacyCoordinates;
  /** Array of fields to place on the PDF. */
  fields?: PdfField[];
  status: "pending" | "signed" | "expired";
  createdAt: number;
  signedPdfPath?: string;
  signerEmail?: string;
}

function toSessionData(row: {
  token: string;
  originalFilename: string;
  pdfBase64: string | null;
  fields: unknown;
  status: string;
  signerEmail: string | null;
  createdAt: Date;
}): SessionData {
  const fields = (row.fields as PdfField[] | null) ?? undefined;
  const firstSig = fields?.find((f) => f.type === "signature");
  const coordinates = firstSig
    ? {
        page: firstSig.page,
        xRatio: firstSig.xRatio,
        yRatio: firstSig.yRatio,
        width: firstSig.width,
        height: firstSig.height,
      }
    : undefined;

  return {
    token: row.token,
    originalFilename: row.originalFilename,
    pdfPath: "",
    pdfBase64: row.pdfBase64 ?? undefined,
    coordinates,
    fields,
    status: row.status as SessionData["status"],
    createdAt: row.createdAt.getTime(),
    signerEmail: row.signerEmail ?? undefined,
  };
}

export async function getSessionData(tokenId: string): Promise<SessionData | null> {
  try {
    const row = await prisma.signingSession.findUnique({
      where: { token: tokenId },
    });
    if (!row) return null;
    return toSessionData(row);
  } catch (error) {
    console.error(`Error reading signing session ${tokenId}:`, error);
    return null;
  }
}

export async function saveSessionData(tokenId: string, data: SessionData): Promise<void> {
  try {
    await prisma.signingSession.upsert({
      where: { token: tokenId },
      create: {
        token: tokenId,
        originalFilename: data.originalFilename,
        pdfBase64: data.pdfBase64 ?? null,
        fields: data.fields != null ? (data.fields as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: data.status,
        signerEmail: data.signerEmail ?? null,
        updatedAt: new Date(),
      },
      update: {
        originalFilename: data.originalFilename,
        pdfBase64: data.pdfBase64 ?? null,
        fields: data.fields != null ? (data.fields as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: data.status,
        signerEmail: data.signerEmail ?? null,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Error saving signing session ${tokenId}:`, error);
    throw error;
  }
}

export async function deleteSessionFile(tokenId: string): Promise<void> {
  try {
    await prisma.signingSession.delete({
      where: { token: tokenId },
    }).catch(() => {});
  } catch (error) {
    console.error(`Error deleting signing session ${tokenId}:`, error);
  }
}
