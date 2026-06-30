import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

export default withAuth(
  async (req, res) => {
    const { clientId } = req.query;

    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ message: "Client ID is required" });
    }

    try {
      const client = await prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      await prisma.client.delete({
        where: { id: clientId }
      });

      res.status(200).json({ message: "Client deleted successfully", clientId });
    } catch (err) {
      console.error("/api/admin/deleteClient error", err);
      res.status(500).json({ message: "Failed to delete client" });
    }
  },
  { methods: ["DELETE"], roles: ["admin"] }
);
