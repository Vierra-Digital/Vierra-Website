import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { screenCartographyQuery } from "@/lib/cartography/screenQuery";
import { persistScreeningRejection } from "@/lib/cartography/persistRun";
import { startProspectDiscovery } from "@/lib/cartography/prospectMethod";
import { resolveTargetCompanyId } from "@/lib/api/targetCompany";

export type { CartographyAgentCandidate, SubAgentTaskResult, DiscoveryMethod } from "@/lib/cartography/agentOrchestrator";

/**
 * Cartography's Agentic-mode backend. Every submitted description passes
 * screenCartographyQuery() before anything runs — same gate Search mode's endpoint uses —
 * then starts a real /prospect job via lib/cartography/prospectMethod.ts (backed by
 * lib/prospect/startJob.ts). This replaced the old synchronous LLM-brainstorm sub-agent
 * orchestrator (lib/cartography/agentOrchestrator.ts, kept only for its exported types, which
 * other Cartography code still references).
 *
 * /prospect is async, so this only submits and hands back a job_id — the caller polls
 * pages/api/prospect/[jobId].ts for progress and, once terminal, posts to
 * pages/api/cartography/agent/persist.ts to turn the finished job into a cartography_runs row.
 */
export default withAuth(
  async (req, res, session) => {
    const description = asStr(req.body?.description);
    const companyId = resolveTargetCompanyId(session, req);
    if (!companyId) {
      res.status(400).json({ message: "companyId is required" });
      return;
    }
    const createdBy = session.user.id;

    const screening = screenCartographyQuery(description);
    if (!screening.ok) {
      await persistScreeningRejection({ companyId, createdBy, icpDescription: description, reason: screening.reason });
      res.status(400).json({ message: screening.reason });
      return;
    }

    const outcome = await startProspectDiscovery(companyId, description, createdBy);
    if (!outcome.ok) {
      res.status(outcome.status).json({ message: outcome.message });
      return;
    }

    res.status(202).json({ jobId: outcome.jobId });
  },
  { methods: ["POST"] }
);
