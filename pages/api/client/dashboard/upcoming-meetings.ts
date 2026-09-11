import { withSession } from "@/lib/api/withSession";
import { getUpcomingMeetingsForCompany } from "@/lib/booking/clientMeetings";

export default withSession(
  async (req, res, session) => {
    if (session.kind !== "client") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const meetings = await getUpcomingMeetingsForCompany(session.companyId);
    res.status(200).json({ meetings });
  },
  { methods: ["GET"] }
);
