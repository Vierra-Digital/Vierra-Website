import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const userEmail = (session.user as any)?.email;
    if (!userEmail) {
      return res.status(400).json({ message: "User email not found in session" });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        company_memberships_company_memberships_user_idTousers: { select: { role: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      role: user.company_memberships_company_memberships_user_idTousers?.role ?? null,
    });
  },
  { methods: ["GET"] }
);
