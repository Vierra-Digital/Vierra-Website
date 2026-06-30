import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { putImageAsset } from "@/lib/api/image";
import { STORAGE_BUCKETS } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default withAuth(
  async (req, res, session) => {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const { imageData, mimeType } = req.body;
    if (imageData === null && mimeType === null) {
      await prisma.userPreference.upsert({
        where: { user_id: existingUser.id },
        create: { user_id: existingUser.id, image_storage_key: null, image_mime_type: null, image_updated_at: null },
        update: { image_storage_key: null, image_mime_type: null, image_updated_at: null },
      });
      return res.status(200).json({ id: existingUser.id, name: existingUser.name, email: existingUser.email });
    }

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "Image data and mime type are required" });
    }
    const imageBuffer = Buffer.from(imageData, 'base64');
    const storageKey = await putImageAsset(
      STORAGE_BUCKETS.avatars,
      `user/${existingUser.id}`,
      imageBuffer,
      mimeType
    );
    await prisma.userPreference.upsert({
      where: { user_id: existingUser.id },
      create: { user_id: existingUser.id, image_storage_key: storageKey, image_mime_type: mimeType, image_updated_at: new Date() },
      update: { image_storage_key: storageKey, image_mime_type: mimeType, image_updated_at: new Date() },
    });

    return res.status(200).json({ id: existingUser.id, name: existingUser.name, email: existingUser.email });
  },
  { methods: ["POST"] }
);
