import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const { name } = req.body ?? {};

    if (typeof name !== "string") {
      return res.status(400).json({ message: "Name must be a string" });
    }

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

    const updated = await prisma.user.update({
      where: { email: userEmail },
      data: { name: name.trim() || null },
      select: { id: true, name: true, email: true },
    });

    return res.status(200).json(updated);
  },
  { methods: ["PUT"] }
);
