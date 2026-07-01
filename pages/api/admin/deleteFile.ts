import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/withAuth"
import { deleteFileAsset, STORAGE_BUCKETS } from "@/lib/storage"

export default withAuth(
  async (req, res, session) => {
    const role = (session.user as { role?: string })?.role

    const id = req.query.id ?? (req.body && (req.body as { id?: string }).id)
    const fileId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null
    if (!fileId) {
      return res.status(400).json({ message: "File id is required." })
    }

    const uid = (session.user as { id?: string })?.id ?? null

    try {
      const file = await prisma.storedFile.findUnique({
        where: { id: fileId },
        select: { user_id: true, client_id: true, is_deletion_protected: true, storage_key: true },
      })
      if (!file) {
        return res.status(404).json({ message: "File not found." })
      }
      if (file.is_deletion_protected) {
        return res.status(403).json({ message: "This file is protected and cannot be deleted." })
      }
      const isOwner = file.user_id != null && uid != null && file.user_id === uid
      const canManageClientFile = (role === "admin" || role === "staff") && file.client_id != null
      const canDelete = role === "admin" || isOwner || canManageClientFile
      if (!canDelete) {
        return res.status(403).json({ message: "You can only delete files saved to you." })
      }
      await prisma.storedFile.delete({ where: { id: fileId } })
      await deleteFileAsset(STORAGE_BUCKETS.docs, file.storage_key)
      return res.status(200).json({ success: true })
    } catch (e) {
      console.error("deleteFile error", e)
      return res.status(500).json({ message: "Failed to delete file." })
    }
  },
  { methods: ["DELETE"], roles: ["admin", "staff"] }
)
