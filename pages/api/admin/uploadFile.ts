import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { objectExists, STORAGE_BUCKETS } from "@/lib/storage";
import { getUploadFileType } from "@/lib/files/uploadTypes";

/**
 * Confirms a direct-to-storage upload (see uploadFileUrl.ts) and records it as a `stored_files`
 * row. Storage is checked before the row is written so a row never promises bytes that were never
 * actually uploaded.
 */
export default withAuth(
  async (req, res, session) => {
    const { companyId } = session;
    const storageKey = asStr(req.body?.storageKey);
    const filename = asStr(req.body?.filename) || "Untitled";
    const clientId = asStr(req.body?.clientId);

    if (!storageKey.startsWith("docs/")) {
      return res.status(400).json({ message: "Invalid storage key" });
    }
    const fileType = getUploadFileType(filename);
    if (!fileType) {
      return res.status(400).json({ message: "Unsupported file type." });
    }
    if (!(await objectExists(STORAGE_BUCKETS.docs, storageKey))) {
      return res.status(400).json({ message: "Upload did not complete" });
    }

    try {
      let targetClientId: string | null = null;
      let targetCompanyId = companyId;

      if (clientId) {
        // Any Vierra staff member may upload a file to any client (see
        // docs/ROLE_MODEL_REDESIGN.md's "v2" section) — looked up by id alone, and filed under
        // that client's own company, not the caller's (Vierra's fixed company).
        const client = await prisma.client.findFirst({
          where: { id: clientId },
          select: { id: true, company_id: true },
        });
        if (!client) return res.status(404).json({ message: "Client not found." });
        targetClientId = client.id;
        targetCompanyId = client.company_id;
      }

      const file = await prisma.storedFile.create({
        data: {
          name: filename,
          file_type: fileType,
          storage_key: storageKey,
          company_id: targetCompanyId,
          user_id: targetClientId ? null : session.user.id,
          client_id: targetClientId,
        },
        select: { id: true },
      });
      return res.status(201).json({ success: true, id: file.id });
    } catch (e) {
      console.error("admin/uploadFile", e);
      return res.status(500).json({ message: "Failed to save the uploaded file." });
    }
  },
  { methods: ["POST"], roles: ["admin", "staff"] }
);
