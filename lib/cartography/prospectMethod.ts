/**
 * /prospect-backed Cartography helpers. This is Agentic mode's real backend now (see
 * pages/api/cartography/agent.ts and pages/api/cartography/agent/persist.ts) -- it replaced the
 * synchronous LLM-brainstorm sub-agent orchestrator (agentOrchestrator.ts), which is kept around
 * only for its exported types and the "not_implemented" method shape the UI still renders for
 * Google Business / LinkedIn Sales Nav. Uses its own local candidate/task types rather than
 * agentOrchestrator.ts's so this module doesn't need that one widened to describe a "prospect"
 * method.
 */

import { prisma } from "@/lib/prisma";
import { startProspectJob } from "@/lib/prospect/startJob";

export type ProspectStartOutcome =
  | { ok: true; jobId: string }
  | { ok: false; status: number; message: string };

type ProspectCandidate = {
  company: string;
  industry: string;
  description: string;
  location: string;
  suggestedTitle: string;
  sourceMethod: "prospect";
  domain: string | null;
};

type ProspectTaskResult =
  | { method: "prospect"; status: "completed"; candidateCount: number }
  | { method: "prospect"; status: "failed"; error: string };

/**
 * Cartography's companyId identifies a client's whole company, shared across every teammate on
 * it (see pages/api/context/client.ts) -- but /prospect's seeker lookup is keyed on a specific
 * client row. Any client row for that company resolves to the same onboarding context, so this
 * just picks one deterministically (oldest) rather than needing the caller to know which.
 */
async function resolveSeekerClientId(companyId: string): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: { company_id: companyId },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });
  return client?.id ?? null;
}

export async function startProspectDiscovery(
  companyId: string,
  description: string,
  requestedBy: string
): Promise<ProspectStartOutcome> {
  const clientId = await resolveSeekerClientId(companyId);
  if (!clientId) return { ok: false, status: 404, message: "No client found for this company." };

  const result = await startProspectJob({ clientId, goal: description, requestedBy });
  if (!result.ok) return result;
  return { ok: true, jobId: result.jobId };
}

type ProspectCompany = {
  name?: { value?: string };
  domain?: { value?: string };
  geo?: { city?: { value?: string }; region?: { value?: string } };
  contacts?: Array<{ title?: { value?: string } }>;
  raw?: { reasons?: string[] };
};

function toCandidate(company: ProspectCompany): ProspectCandidate {
  const city = company.geo?.city?.value;
  const region = company.geo?.region?.value;
  return {
    company: company.name?.value || "Unknown",
    industry: "",
    description: company.raw?.reasons?.[0] || "",
    location: [city, region].filter(Boolean).join(", "),
    suggestedTitle: company.contacts?.[0]?.title?.value || "",
    sourceMethod: "prospect",
    domain: company.domain?.value || null,
  };
}

/**
 * Converts a finished /prospect job's payload (cached verbatim in artemis_prospect_jobs.result --
 * see pages/api/prospect/[jobId].ts) into the same {tasks, candidates} shape runCartographyAgent
 * returns, so persistCartographyRun doesn't need a prospect-specific persistence path.
 */
export function prospectResultToRunResult(payload: unknown): { tasks: ProspectTaskResult[]; candidates: ProspectCandidate[] } {
  const results = Array.isArray((payload as { results?: unknown })?.results)
    ? ((payload as { results: ProspectCompany[] }).results)
    : [];
  const error = (payload as { error?: string })?.error;
  const candidates = results.map(toCandidate);

  const task: ProspectTaskResult = error
    ? { method: "prospect", status: "failed", error }
    : { method: "prospect", status: "completed", candidateCount: candidates.length };

  return { tasks: [task], candidates };
}

/**
 * Persists a completed /prospect job as a cartography_runs row, exactly once -- prospect_job_id
 * is unique, so a job observed "done" on more than one poll (repeat GETs while a previous poll's
 * persistence is still in flight, or a client re-polling after already seeing it done) hits a
 * conflict on the second attempt rather than double-writing candidates. Returns the existing
 * run instead of erroring when that happens.
 */
export async function persistCompletedProspectJob(params: {
  jobId: string;
  companyId: string;
  clientId: string;
  createdBy: string | null;
  goal: string;
  payload: unknown;
}): Promise<{ runId: string } | null> {
  const existing = await prisma.cartographyRun.findUnique({ where: { prospect_job_id: params.jobId } });
  if (existing) return { runId: existing.id };

  const { tasks, candidates } = prospectResultToRunResult(params.payload);
  // Mirrors computeRunStatus's rule from persistRun.ts (kept separate: its input type is scoped
  // to the three sub-agent methods, not "prospect").
  const status = tasks.every((t) => t.status === "failed") ? "failed" : candidates.length > 0 ? "review_pending" : "completed";

  try {
    const run = await prisma.cartographyRun.create({
      data: {
        company_id: params.companyId,
        client_id: params.clientId,
        created_by: params.createdBy,
        mode: "client_spec",
        icp_description: params.goal,
        status,
        prospect_job_id: params.jobId,
        completed_at: new Date(),
        cartography_run_tasks: {
          create: tasks.map((task) => ({
            method: task.method,
            status: task.status,
            candidate_count: task.status === "completed" ? task.candidateCount : null,
            error: task.status === "failed" ? task.error : null,
            started_at: new Date(),
            completed_at: new Date(),
          })),
        },
      },
      include: { cartography_run_tasks: true },
    });
    const taskId = run.cartography_run_tasks[0]?.id ?? null;

    for (const candidate of candidates) {
      const company = await prisma.cartographyCompany.create({
        data: {
          company_id: params.companyId,
          name: candidate.company,
          domain: candidate.domain || null,
          industry: candidate.industry || null,
          description: candidate.description || null,
          address: candidate.location || null,
          source_method: candidate.sourceMethod,
        },
      });
      await prisma.cartographyContact.create({
        data: {
          company_id: params.companyId,
          cartography_company_id: company.id,
          run_id: run.id,
          task_id: taskId,
          title: candidate.suggestedTitle || null,
          status: "candidate",
        },
      });
    }

    return { runId: run.id };
  } catch (error) {
    // Same "a persistence failure never costs the caller its already-found candidates" posture
    // as persistCartographyRun -- but here a conflict specifically means another poll already
    // won the race, so re-check rather than treating every failure as a lost write.
    const raced = await prisma.cartographyRun.findUnique({ where: { prospect_job_id: params.jobId } });
    if (raced) return { runId: raced.id };
    console.error("[cartography] failed to persist prospect run:", error);
    return null;
  }
}
