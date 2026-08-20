import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(async (req, res, session) => {
  try {
    const memberships = await prisma.companyMembership.findMany({
      where: { company_id: session.companyId },
      select: {
        role: true,
        position: true,
        users_company_memberships_user_idTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            user_preferences: { select: { image_storage_key: true } },
          },
        },
      },
    });

    const members = memberships.map((m) => ({
      id: m.users_company_memberships_user_idTousers.id,
      name: m.users_company_memberships_user_idTousers.name,
      email: m.users_company_memberships_user_idTousers.email,
      role: m.role,
      position: m.position,
      image: Boolean(m.users_company_memberships_user_idTousers.user_preferences?.image_storage_key),
    }));

    return res.status(200).json(members);
  } catch (e) {
    console.error("project/boardMembers GET", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}, { methods: ["GET"], roles: ["admin", "staff"] });
