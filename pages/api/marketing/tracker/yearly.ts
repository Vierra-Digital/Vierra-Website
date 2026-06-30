import { withAuth } from "@/lib/api/withAuth";
import { getMarketingYearlySummary } from "@/lib/marketingYearlySummary";

export default withAuth(async (req, res, session) => {
  const userId = session.user.id;
  const year = req.query.year ? Number(req.query.year) : undefined;

  try {
    const rows = await getMarketingYearlySummary(userId, year);
    res.status(200).json({ summary: rows });
  } catch (e) {
    console.error("Error fetching marketing yearly summary:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}, { methods: ["GET"] });
