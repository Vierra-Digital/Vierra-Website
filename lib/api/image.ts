import type { NextApiResponse } from "next";

export function decodeBase64Image(imageData: string): Buffer {
  return Buffer.from(imageData, "base64");
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

