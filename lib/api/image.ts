import type { NextApiResponse } from "next";
import { uploadObject, downloadObject } from "@/lib/storage";

export function decodeBase64Image(imageData: string): Buffer {
  return Buffer.from(imageData, "base64");
}

/** Store an image in object storage; returns the storage key. */
export async function putImageAsset(
  bucket: string,
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await uploadObject(bucket, key, buffer, mimeType);
  return key;
}

/** Send an image from object storage by `storageKey`; returns false when there's no key. */
export async function sendImageAsset(
  res: NextApiResponse,
  opts: {
    bucket: string;
    storageKey?: string | null;
    mimeType?: string | null;
    cacheControl?: string;
  }
): Promise<boolean> {
  if (!opts.storageKey) return false;
  const buf = await downloadObject(opts.bucket, opts.storageKey);
  sendImageBuffer(res, buf, opts.mimeType, opts.cacheControl);
  return true;
}

function sendImageBuffer(
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

