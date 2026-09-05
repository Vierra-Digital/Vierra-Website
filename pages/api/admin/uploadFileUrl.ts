import { v4 as uuidv4 } from "uuid";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { createSignedUploadUrl, storageConfigured, STORAGE_BUCKETS } from "@/lib/storage";
import { getUploadFileType } from "@/lib/files/uploadTypes";

/**
 * Mint a signed URL the Files tab can upload a document straight to, mirroring
 * /api/blog/admin/upload-url — the function only issues a capability and never sees the bytes,
 * so the upload isn't capped by the platform's request body limit.
 */
export default withAuth(
  async (req, res) => {
    if (!storageConfigured()) {
      return res.status(503).json({ message: "Object storage is not configured." });
    }

    const filename = asStr(req.body?.filename);
    if (!filename) {
      return res.status(400).json({ message: "filename is required" });
    }
    if (!getUploadFileType(filename)) {
      return res.status(400).json({ message: "Unsupported file type." });
    }

    try {
      const { signedUrl, storageKey } = await createSignedUploadUrl(STORAGE_BUCKETS.docs, `docs/${uuidv4()}`);
      return res.status(200).json({ signedUrl, storageKey });
    } catch (e) {
      console.error("admin/uploadFileUrl", e);
      return res.status(500).json({ message: "Could not start the upload." });
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
