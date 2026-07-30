import { withSession } from "@/lib/api/withSession";

export default withSession(async (req, res, session) => {
  return res.status(200).json({
    ...session.user,
    kind: session.kind,
    companyId: (session as any).companyId,
    clientId: (session as any).clientId,
  });
});
