import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const { status } = req.body;
    if (status && !["online", "offline", "away", "busy"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (status) {
      await prisma.companyMembership.updateMany({
        where: { user_id: user.id },
        data: { status },
      });
    }

    return res.status(200).json({ id: user.id, name: user.name, email: user.email, status: status ?? null });
  },
  { methods: ["POST"] }
);
