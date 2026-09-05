import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { deleteSupabaseAuthUser } from "@/lib/supabase/admin";

export default withAuth(
  async (req, res) => {
    const { clientId } = req.query;

    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ message: "Client ID is required" });
    }

    try {
      // Any Vierra admin may act on any client's representative record (see
      // docs/ROLE_MODEL_REDESIGN.md's "v2" section) — looked up by id alone.
      const client = await prisma.client.findFirst({
        where: { id: clientId }
      });

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      await prisma.client.delete({
        where: { id: clientId }
      });

      // Deleting the `clients` row alone leaves the client's Supabase Auth identity intact —
      // their email/password would keep working with nothing left for it to authorize. Best
      // effort: the row is already gone either way, so a failure here is logged, not fatal.
      let authCleanupFailed = false;
      if (client.user_id) {
        await deleteSupabaseAuthUser(client.user_id).catch((err) => {
          authCleanupFailed = true;
          console.error("/api/admin/deleteClient auth cleanup failed", clientId, err);
        });
      }

      res.status(200).json({ message: "Client deleted successfully", clientId, authCleanupFailed });
    } catch (err) {
      console.error("/api/admin/deleteClient error", err);
      res.status(500).json({ message: "Failed to delete client" });
    }
  },
  { methods: ["DELETE"], roles: ["admin"] }
);
