import { withSession } from "@/lib/api/withSession";
import { startProspectJob } from "@/lib/prospect/startJob";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default withSession(
  async (req, res, session) => {
    // The seeker is always the caller's own client row -- never taken from the request body, so a
    // signed-in client can't prospect against another company's profile by passing a different id.
    // A member (Vierra staff) has no client of their own, so they must name one explicitly.
    let clientId: string | null = null;
    if (session.kind === "client") {
      clientId = session.clientId;
    } else if (session.kind === "member") {
      clientId = asString(req.body?.clientId) || null;
    }
    if (!clientId) return res.status(400).json({ message: "clientId is required." });

    const goal = asString(req.body?.goal);
    if (!goal) return res.status(400).json({ message: "goal is required." });

    const partnershipTypes = Array.isArray(req.body?.partnershipTypes)
      ? req.body.partnershipTypes.filter((t: unknown): t is string => typeof t === "string")
      : undefined;

    const geo =
      req.body?.geo && typeof req.body.geo === "object"
        ? { city: asString(req.body.geo.city) || undefined, region: asString(req.body.geo.region) || undefined }
        : undefined;

    const excludeDomains = Array.isArray(req.body?.exclude?.domains)
      ? req.body.exclude.domains.filter((d: unknown): d is string => typeof d === "string")
      : undefined;

    const result = await startProspectJob({
      clientId,
      goal,
      requestedBy: session.user.id,
      partnershipTypes,
      n: Number(req.body?.n) || undefined,
      geo,
      excludeDomains,
    });

    if (!result.ok) return res.status(result.status).json({ message: result.message });
    return res.status(202).json({ job_id: result.jobId, status: "queued" });
  },
  { methods: ["POST"] }
);
