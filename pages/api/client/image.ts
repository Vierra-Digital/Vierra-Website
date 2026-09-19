import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";
import { resolveBillingClient } from "@/lib/api/billingClient";

/**
 * A client's profile picture, set by a Vierra admin from the client view.
 *
 * The equivalent profile route writes to the SIGNED-IN user's preferences, so wiring the client
 * page's avatar control to it would have replaced the staff member's own picture rather than the
 * client's. This writes to the client row, which is where /api/admin/getClientImage already reads
 * one from.
 *
 * Admins only. Staff run campaigns; changing who a client appears to be is not part of that.
 */

export const config = {
  api: {
    bodyParser: {
      // Matches the profile route: a phone camera photo is comfortably over the 1mb default, and
      // the crop dialog sends the whole thing base64-encoded.
      sizeLimit: "50mb",
    },
  },
};

export default withAuth(
  async (req, res, session) => {
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    // The same resolver the billing and settings routes use, so every client-scoped route on this
    // page acts on one row.
    const client = await resolveBillingClient({ kind: "member", companyId });
    if (!client) return res.status(404).json({ message: "No client for that company." });

    const { imageData, mimeType } = req.body ?? {};

    // Both null is "reset to the default", the same signal the profile route takes.
    if (imageData === null && mimeType === null) {
      await prisma.client.update({
        where: { id: client.id },
        data: { image_storage_key: null, image_mime_type: null, updated_at: new Date() },
      });
      return res.status(200).json({ id: client.id, image: null });
    }

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "Image data and mime type are required" });
    }
    if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
      return res.status(400).json({ message: "That is not an image." });
    }

    try {
      const storageKey = await putImageAsset(
        STORAGE_BUCKETS.avatars,
        `client/${client.id}`,
        Buffer.from(imageData, "base64"),
        mimeType
      );
      await prisma.client.update({
        where: { id: client.id },
        data: { image_storage_key: storageKey, image_mime_type: mimeType, updated_at: new Date() },
      });
      return res.status(200).json({ id: client.id, image: storageKey });
    } catch (e) {
      console.error("client/image", e);
      return res.status(500).json({ message: "Could not save that picture." });
    }
  },
  { methods: ["POST"], roles: ["admin"] }
);
