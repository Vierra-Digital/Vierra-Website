import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100 * 100) / 100 : 0;
}

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;

  if (req.method === "GET") {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) {
      res.status(400).json({ message: "Missing year or month" });
      return;
    }
    try {
      const rows = await prisma.marketingTracker.findMany({
        where: { user_id: userId, year, month },
        select: {
          outreach: true,
          attempt: true,
          meetings_set: true,
          clients_closed: true,
          revenue_cents: true,
        },
      });
      const trackerData = rows.map((row) => ({
        outreach: row.outreach,
        attempt: row.attempt,
        meetingsSet: row.meetings_set,
        clientsClosed: row.clients_closed,
        revenue: row.revenue_cents / 100,
        attemptsToMeetingsPct: pct(row.meetings_set, row.attempt),
        meetingsToClientsPct: pct(row.clients_closed, row.meetings_set),
      }));
      res.status(200).json({ trackerData });
    } catch (e) {
      console.error("Error fetching marketing tracker:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const { year, month, trackerData } = req.body;
  if (!year || !month || !Array.isArray(trackerData)) {
    res.status(400).json({ message: "Missing required fields" });
    return;
  }

  try {
    for (const tracker of trackerData) {
      const { outreach, attempt, meetingsSet, clientsClosed, revenue } = tracker;
      const revenueCents = Math.round(Number(revenue || 0) * 100);

      await prisma.marketingTracker.upsert({
        where: {
          user_id_year_month_outreach: {
            user_id: userId,
            year,
            month,
            outreach,
          },
        },
        update: {
          attempt,
          meetings_set: meetingsSet,
          clients_closed: clientsClosed,
          revenue_cents: revenueCents,
          updated_at: new Date(),
        },
        create: {
          company_id: session.companyId,
          user_id: userId,
          year,
          month,
          outreach,
          attempt,
          meetings_set: meetingsSet,
          clients_closed: clientsClosed,
          revenue_cents: revenueCents,
        },
      });
    }
    res.status(200).json({ success: true });
  } catch (e) {
    console.error("Error updating marketing tracker:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}, { methods: ["GET", "POST"] });
