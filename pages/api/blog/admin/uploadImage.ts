import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { putImageAsset } from "@/lib/api/image";
import { objectExists, STORAGE_BUCKETS } from "@/lib/storage";

/**
 * Record a blog image and return the URL the editor should embed.
 *
 * Two ways in:
 *
 *  - `storageKey` — the browser already PUT the file to a signed URL from
 *    /api/blog/admin/upload-url, so there are no bytes in this request at all. Preferred: the
 *    image never passes through a function, so the size ceiling is the bucket's rather than the
 *    platform's request body limit.
 *  - `imageData` — the original base64-in-JSON path, kept for when object storage is unconfigured
 *    and for any client that has not been updated. Subject to the request body limit, which is
 *    well under the 50mb this route used to advertise, and base64 inflates the payload ~33% on top.
 */
export const config = {
  api: {
    bodyParser: {
      // Only the inline fallback sends bytes. The direct path posts a short JSON object, and the
      // platform caps the request well below this anyway — this is a guard, not a promise.
      sizeLimit: "8mb",
    },
  },
};

export default withAuth(
  async (req, res) => {
    const { imageData, mimeType, filename, storageKey } = req.body ?? {};

    if (!mimeType || typeof mimeType !== "string") {
      return res.status(400).json({ message: "Mime type is required" });
    }

    try {
      let key: string;

      if (typeof storageKey === "string" && storageKey) {
        // Trust the client for the key but not for the upload: a row pointing at bytes that were
        // never stored renders as a permanently broken image with nothing to retry.
        if (!storageKey.startsWith("blog/")) {
          return res.status(400).json({ message: "Invalid storage key" });
        }
        if (!(await objectExists(STORAGE_BUCKETS.blog, storageKey))) {
          return res.status(400).json({ message: "Upload did not complete" });
        }
        key = storageKey;
      } else {
        if (!imageData) {
          return res.status(400).json({ message: "Image data or a storage key is required" });
        }
        const imageBuffer = Buffer.from(imageData, "base64");
        // Upload to object storage first so no orphan row is created if the upload fails.
        key = await putImageAsset(STORAGE_BUCKETS.blog, `blog/${uuidv4()}`, imageBuffer, mimeType);
      }

      const image = await prisma.blogImage.create({
        data: {
          storage_key: key,
          mime_type: mimeType,
          filename: filename || null,
        },
      });
      return res.status(200).json({ url: `/api/blog/image/${image.id}`, id: image.id });
    } catch (e) {
      console.error("blog/admin/uploadImage", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
