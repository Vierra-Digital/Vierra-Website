import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  const email = normalizeEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ message: "Email is required." });
    return;
  }

  try {
    const platform = `gmail:${email}`;
    const deleted = await prisma.platformToken.deleteMany({
      where: { user_id: userId, platform },
    });

    if (deleted.count === 0) {
      res.status(404).json({ message: "Gmail account token not found." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("gmail delete error", error);
    res.status(500).json({ message: "Failed to delete Gmail account." });
  }
}, { methods: ["POST"] });
