import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { screenCartographyQuery } from "@/lib/cartography/screenQuery";
import { runCartographyAgent } from "@/lib/cartography/agentOrchestrator";
import { persistCartographyRun, persistScreeningRejection } from "@/lib/cartography/persistRun";

export type { CartographyAgentCandidate, SubAgentTaskResult, DiscoveryMethod } from "@/lib/cartography/agentOrchestrator";

/**
 * Cartography's Agentic-mode backend (see docs/CARTOGRAPHY_DESIGN.md rollout phase 2 and its
 * "Sub-agent orchestration" section). Every submitted description passes
 * screenCartographyQuery() before anything runs — same gate Search mode's endpoint uses once
 * it exists — then fans out to lib/cartography/agentOrchestrator.ts's per-method sub-agents.
 *
 * Persists the run via lib/cartography/persistRun.ts (see Rollout M2) — but persistence
 * failing (e.g. Supabase unreachable) never costs the caller the candidates the agent already
 * found; `runId` is simply omitted from the response when that happens.
 */
export default withAuth(
  async (req, res, session) => {
    const description = asStr(req.body?.description);
    const companyId = session.companyId;
    const createdBy = session.user.id;

    const screening = screenCartographyQuery(description);
    if (!screening.ok) {
      await persistScreeningRejection({ companyId, createdBy, icpDescription: description, reason: screening.reason });
      res.status(400).json({ message: screening.reason });
      return;
    }

    const { tasks, candidates } = await runCartographyAgent(description);
    const persisted = await persistCartographyRun({ companyId, createdBy, icpDescription: description, result: { tasks, candidates } });

    res.status(200).json({ tasks, candidates, runId: persisted?.runId ?? null });
  },
  { methods: ["POST"] }
);
