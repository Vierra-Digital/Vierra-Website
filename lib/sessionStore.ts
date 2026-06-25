import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFileBuffer, putFileAsset, STORAGE_BUCKETS, toStorageKeySegment } from "@/lib/storage";

type PdfFieldType = "signature" | "date" | "text";

export interface PdfField {
  type: PdfFieldType;
  page: number;
  xRatio: number;
  yRatio: number;
  width: number;
  height: number;
  id?: string;
}

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
  coordinates?: LegacyCoordinates;
  fields?: PdfField[];
  status: "pending" | "signed" | "expired";
  createdAt: number;
  signedPdfPath?: string;
  signerEmail?: string;
}

async function toSessionData(row: {
  token: string;
  original_filename: string;
  pdf_storage_key: string | null;
  fields: unknown;
  status: string;
  signer_email: string | null;
  created_at: Date;
}): Promise<SessionData> {
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

  const pdfBuffer = await getFileBuffer(STORAGE_BUCKETS.docs, row.pdf_storage_key);

  return {
    token: row.token,
    originalFilename: row.original_filename,
    pdfPath: "",
    pdfBase64: pdfBuffer ? pdfBuffer.toString("base64") : undefined,
    coordinates,
    fields,
    status: row.status as SessionData["status"],
    createdAt: row.created_at.getTime(),
    signerEmail: row.signer_email ?? undefined,
  };
}

export async function getSessionData(tokenId: string): Promise<SessionData | null> {
  try {
    const row = await prisma.signingSession.findUnique({
      where: { token: tokenId },
    });
    if (!row) return null;
    return await toSessionData(row);
  } catch (error) {
    console.error(`Error reading signing session ${tokenId}:`, error);
    return null;
  }
}

export async function saveSessionData(tokenId: string, data: SessionData): Promise<void> {
  try {
    let pdfStorageKey: string | undefined;
    if (data.pdfBase64) {
      pdfStorageKey = await putFileAsset(
        STORAGE_BUCKETS.docs,
        `documents/signing/${toStorageKeySegment(tokenId)}.pdf`,
        Buffer.from(data.pdfBase64, "base64"),
        "application/pdf"
      );
    }

    await prisma.signingSession.upsert({
      where: { token: tokenId },
      create: {
        token: tokenId,
        original_filename: data.originalFilename,
        pdf_storage_key: pdfStorageKey ?? null,
        fields: data.fields != null ? (data.fields as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: data.status,
        signer_email: data.signerEmail ?? null,
        updated_at: new Date(),
      },
      update: {
        original_filename: data.originalFilename,
        ...(pdfStorageKey !== undefined ? { pdf_storage_key: pdfStorageKey } : {}),
        fields: data.fields != null ? (data.fields as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: data.status,
        signer_email: data.signerEmail ?? null,
        updated_at: new Date(),
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
