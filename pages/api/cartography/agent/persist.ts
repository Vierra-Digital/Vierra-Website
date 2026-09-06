import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/prisma";
import { persistCompletedProspectJob, prospectResultToRunResult } from "@/lib/cartography/prospectMethod";

/**
 * Called once the frontend has polled pages/api/prospect/[jobId].ts to a terminal status
 * ("done" or "failed") for a job that pages/api/cartography/agent.ts started. Turns that job
 * into a cartography_runs row (same {tasks, candidates, runId} shape a synchronous run
 * returns) so the rest of the Agentic-mode UI and the Review Queue don't need to know /prospect
 * results arrived on a different timeline than the other sub-agents'.
 */
export default withAuth(
  async (req, res) => {
    const jobId = typeof req.body?.jobId === "string" ? req.body.jobId : null;
    if (!jobId) return res.status(400).json({ message: "jobId is required." });

    const job = await prisma.artemisProspectJob.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.status !== "done" && job.status !== "failed") {
      return res.status(409).json({ message: "Job has not finished yet." });
    }

    const persisted = await persistCompletedProspectJob({
      jobId: job.id,
      companyId: job.company_id,
      clientId: job.client_id,
      createdBy: job.requested_by,
      goal: job.goal,
      payload: job.result,
    });

    const { tasks, candidates } = prospectResultToRunResult(job.result);
    return res.status(200).json({ mode: "sync", tasks, candidates, runId: persisted?.runId ?? null });
  },
  { methods: ["POST"] }
);
