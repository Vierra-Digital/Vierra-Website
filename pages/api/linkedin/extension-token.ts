import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Manage the logged-in user's per-user extension token (paired with the Sales Nav extension).
 *
 *   GET  → { hasToken: boolean }                 (never returns the token itself)
 *   POST → { token: string }                     (generates/rotates; returned ONCE)
 *   DELETE → { success: true }                   (revokes)
 *
 * The token is a bearer secret, so GET deliberately never echoes it — the plaintext is only
 * shown at the moment of creation. Rotating invalidates the previous token.
 */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { extension_token: true },
      });
      res.status(200).json({ hasToken: Boolean(user?.extension_token) });
      return;
    }

    if (req.method === "POST") {
      const token = `vx_${randomBytes(24).toString("hex")}`;
      await prisma.user.update({ where: { id: userId }, data: { extension_token: token } });
      res.status(200).json({ token });
      return;
    }

    if (req.method === "DELETE") {
      await prisma.user.update({ where: { id: userId }, data: { extension_token: null } });
      res.status(200).json({ success: true });
      return;
    }
  },
  { methods: ["GET", "POST", "DELETE"] }
);
