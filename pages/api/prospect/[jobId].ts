import type { NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withSession } from "@/lib/api/withSession";

const ARTEMIS_PROSPECT_URL = (process.env.ARTEMIS_PROSPECT_URL || "").replace(/\/+$/, "");
const ARTEMIS_PROSPECT_KEY = process.env.ARTEMIS_PROSPECT_KEY || "";

type ArtemisStatus = "queued" | "running" | "done" | "failed" | "interrupted";
const KNOWN_STATUSES: ArtemisStatus[] = ["queued", "running", "done", "failed", "interrupted"];

function respondFromJob(res: NextApiResponse, job: { id: string; status: string; result: unknown; error: string | null }) {
  const cached = (job.result && typeof job.result === "object" ? (job.result as Record<string, unknown>) : {}) as Record<string, unknown>;
  return res.status(200).json({ ...cached, job_id: job.id, status: job.status, error: job.error ?? cached.error });
}

export default withSession(
  async (req, res, session) => {
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId : null;
    if (!jobId) return res.status(400).json({ message: "jobId is required." });

    const job = await prisma.artemisProspectJob.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: "Job not found." });

    // A client session may only ever see its own company's jobs -- job_id alone must not be
    // enough to read another company's prospect results. Staff (member) can see any job.
    if (session.kind === "client" && job.client_id !== session.clientId) {
      return res.status(404).json({ message: "Job not found." });
    }
    if (session.kind === "unaffiliated") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Terminal jobs are served from our own cache (written by the callback's poll-back) so a
    // finished job doesn't need to keep hitting Artemis on every render. 'interrupted' is NOT
    // terminal -- Artemis auto-resumes it, so keep polling live like 'running'.
    if (job.status === "done" || job.status === "failed") {
      return respondFromJob(res, job);
    }

    if (!ARTEMIS_PROSPECT_URL || !ARTEMIS_PROSPECT_KEY) {
      return respondFromJob(res, job);
    }

    try {
      const artemisRes = await fetch(`${ARTEMIS_PROSPECT_URL}/prospect/${encodeURIComponent(jobId)}`, {
        headers: { "x-api-key": ARTEMIS_PROSPECT_KEY },
      });
      if (!artemisRes.ok) return respondFromJob(res, job);

      const payload = (await artemisRes.json()) as { status?: string; error?: string };
      const status: ArtemisStatus = KNOWN_STATUSES.includes(payload.status as ArtemisStatus)
        ? (payload.status as ArtemisStatus)
        : "running";

      const updated = await prisma.artemisProspectJob.update({
        where: { id: jobId },
        data: {
          status,
          result: payload as object,
          error: status === "failed" ? payload.error || "Unknown error" : null,
          updated_at: new Date(),
        },
      });

      return respondFromJob(res, updated);
    } catch (error) {
      console.error("prospect/[jobId]: poll failed", jobId, error);
      return respondFromJob(res, job);
    }
  },
  { methods: ["GET"] }
);
