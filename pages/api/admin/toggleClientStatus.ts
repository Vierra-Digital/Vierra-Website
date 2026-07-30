import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res, session) => {
    const { clientId, isActive } = req.body;

    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ message: "Client ID is required" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    try {
      // Scope to the admin's own company so another company's client can't be toggled.
      const client = await prisma.client.findFirst({
        where: { id: clientId, company_id: session.companyId }
      });

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      await prisma.client.update({
        where: { id: clientId },
        data: { is_active: isActive },
      });

      res.status(200).json({
        message: `Client ${isActive ? 'activated' : 'deactivated'} successfully`,
        clientId,
        isActive
      });
    } catch (err) {
      console.error("/api/admin/toggleClientStatus error", err);
      res.status(500).json({ message: "Failed to update client status" });
    }
  },
  { methods: ["PUT"], roles: ["admin"] }
);
