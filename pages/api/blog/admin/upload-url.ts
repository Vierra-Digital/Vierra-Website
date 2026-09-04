import { v4 as uuidv4 } from "uuid";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { createSignedUploadUrl, storageConfigured, STORAGE_BUCKETS } from "@/lib/storage";

/**
 * Mint a signed URL the editor can upload a blog image straight to.
 *
 * The old path base64-encoded the file into a JSON body and let the API route forward it to
 * storage. That put the whole image through a serverless function twice over — inflated ~33% by
 * base64 on the way in — and capped uploads at the platform's request body limit rather than the
 * bucket's. `bodyParser.sizeLimit` said 50mb, which the function could never actually receive.
 *
 * Here the function only issues a capability and never sees the bytes. The client PUTs to the URL
 * and then calls uploadImage with the returned key to create the row.
 *
 * Same authorization as the upload it replaces: a signed URL is a write into the blog bucket, so
 * it must not be mintable by anyone who could not already upload.
 */
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export default withAuth(
  async (req, res) => {
    if (!storageConfigured()) {
      // The inline base64 route still works against the legacy column, so say which path to take
      // rather than failing the upload outright.
      res.status(503).json({ message: "Object storage is not configured.", fallback: "inline" });
      return;
    }

    const mimeType = asStr(req.body?.mimeType).trim().toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      res.status(400).json({ message: "Unsupported image type." });
      return;
    }

    try {
      const { signedUrl, storageKey } = await createSignedUploadUrl(
        STORAGE_BUCKETS.blog,
        `blog/${uuidv4()}`
      );
      res.status(200).json({ signedUrl, storageKey });
    } catch (e) {
      console.error("blog/admin/upload-url", e);
      res.status(500).json({ message: "Could not start the upload." });
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
