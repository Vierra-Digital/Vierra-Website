import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Outreach reporting summary for the Analytics panel: campaign volume, lead-status
 * breakdown, reply rate, and meetings booked. Campaigns are company-scoped; bookings
 * are user-scoped. Degrades to zeros if the campaign/booking tables aren't present yet.
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = session.companyId;
    const userId = session.user.id;

    try {
      const [campaigns, activeCampaigns, totalContacts, byStatus, bookings, upcomingBookings] = await Promise.all([
        prisma.campaign.count({ where: { company_id: companyId } }),
        prisma.campaign.count({ where: { company_id: companyId, status: { in: ["active", "running"] } } }),
        prisma.campaignContact.count({ where: { campaigns: { company_id: companyId } } }),
        prisma.campaignContact.groupBy({
          by: ["lead_status"],
          where: { campaigns: { company_id: companyId } },
          _count: true,
        }),
        prisma.booking.count({ where: { booking_links: { user_id: userId } } }),
        prisma.booking.count({
          where: { booking_links: { user_id: userId }, status: "confirmed", start_at: { gte: new Date() } },
        }),
      ]);

      const statusMap: Record<string, number> = {};
      for (const row of byStatus) statusMap[row.lead_status] = row._count;
      const replied = (statusMap.replied || 0) + (statusMap.interested || 0) + (statusMap.booked || 0);

      res.status(200).json({
        campaigns,
        activeCampaigns,
        totalContacts,
        statusMap,
        replyRate: totalContacts > 0 ? replied / totalContacts : 0,
        bookings,
        upcomingBookings,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "P2021") {
        res.status(200).json({ campaigns: 0, activeCampaigns: 0, totalContacts: 0, statusMap: {}, replyRate: 0, bookings: 0, upcomingBookings: 0 });
        return;
      }
      throw error;
    }
  },
  { methods: ["GET"] }
);
