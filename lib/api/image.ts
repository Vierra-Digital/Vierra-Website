import type { NextApiResponse } from "next";

export function decodeBase64Image(imageData: string): Buffer {
  return Buffer.from(imageData, "base64");
}

/** Prisma `Bytes` fields expect `Uint8Array` (not `Buffer`) with strict ArrayBuffer typing. */
export function toPrismaBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buf);
}

export function sendImageBuffer(
  res: NextApiResponse,
  image: Buffer | Uint8Array | number[],
  mimeType: string | null | undefined,
  cacheControl = "no-cache, no-store, must-revalidate"
) {
  const imageBuffer = Buffer.from(image);
  res.setHeader("Content-Type", mimeType || "image/jpeg");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", cacheControl);
  res.end(imageBuffer);
}

