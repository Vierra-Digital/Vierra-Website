import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100 * 100) / 100 : 0;
}

/**
 * Per-client outreach analytics for the panel (System 2).
 *
 * GET  ?year&month -> per-client rows for that month + the full active-client
 *                     list (so clients with no data yet still render).
 * POST             -> update the manual funnel fields (meetings/clients/revenue)
 *                     for one client. sent/replied are owned by the extension
 *                     sync and are NOT written here.
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = session.companyId;

    if (req.method === "GET") {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!year || !month) {
        res.status(400).json({ message: "Missing year or month" });
        return;
      }
      try {
        const [rows, clients] = await Promise.all([
          prisma.clientOutreachTracker.findMany({
            where: { company_id: companyId, year, month },
            select: {
              client_id: true,
              outreach: true,
              sent: true,
              replied: true,
              meetings_set: true,
              clients_closed: true,
              revenue_cents: true,
              clients: { select: { business_name: true, name: true } },
            },
          }),
          prisma.client.findMany({
            where: { company_id: companyId, is_active: true },
            select: { id: true, business_name: true, name: true },
            orderBy: { business_name: "asc" },
          }),
        ]);

        const trackerData = rows.map((r) => ({
          clientId: r.client_id,
          clientName: r.clients?.business_name || r.clients?.name || "Unknown",
          outreach: r.outreach,
          sent: r.sent,
          replied: r.replied,
          replyRate: pct(r.replied, r.sent),
          meetingsSet: r.meetings_set,
          clientsClosed: r.clients_closed,
          revenue: r.revenue_cents / 100,
          attemptsToMeetingsPct: pct(r.meetings_set, r.sent),
          meetingsToClientsPct: pct(r.clients_closed, r.meetings_set),
        }));

        res.status(200).json({
          trackerData,
          clients: clients.map((c) => ({ id: c.id, name: c.business_name || c.name })),
        });
      } catch (e) {
        console.error("client-tracker GET error:", e);
        res.status(500).json({ message: "Internal Server Error" });
      }
      return;
    }

    if (req.method === "POST") {
      const { clientId, year, month, outreach, meetingsSet, clientsClosed, revenue } = req.body || {};
      if (!clientId || !year || !month) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }
      const o = outreach ? String(outreach) : "linkedin";
      try {
        // Ensure the client belongs to this company before writing.
        const client = await prisma.client.findFirst({
          where: { id: String(clientId), company_id: companyId },
          select: { id: true },
        });
        if (!client) {
          res.status(404).json({ message: "Client not found" });
          return;
        }
        const meetings = Math.max(0, Math.floor(Number(meetingsSet) || 0));
        const closed = Math.max(0, Math.floor(Number(clientsClosed) || 0));
        const revenueCents = Math.round(Number(revenue || 0) * 100);

        await prisma.clientOutreachTracker.upsert({
          where: {
            client_id_year_month_outreach: {
              client_id: String(clientId),
              year: Number(year),
              month: Number(month),
              outreach: o,
            },
          },
          update: {
            meetings_set: meetings,
            clients_closed: closed,
            revenue_cents: revenueCents,
            updated_at: new Date(),
          },
          create: {
            company_id: companyId,
            client_id: String(clientId),
            user_id: session.user.id,
            year: Number(year),
            month: Number(month),
            outreach: o,
            meetings_set: meetings,
            clients_closed: closed,
            revenue_cents: revenueCents,
          },
        });
        res.status(200).json({ success: true });
      } catch (e) {
        console.error("client-tracker POST error:", e);
        res.status(500).json({ message: "Internal Server Error" });
      }
      return;
    }

    res.status(405).json({ message: "Method Not Allowed" });
  },
  { methods: ["GET", "POST"] }
);
