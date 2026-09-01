/**
 * Persists a completed Cartography agent run to the database (see
 * docs/CARTOGRAPHY_DESIGN.md, Rollout M2). Split from lib/cartography/agentOrchestrator.ts
 * on purpose: the orchestrator is pure/DB-free and unit-tested by mocking Artemis; this
 * module is the DB-touching half, following the same split as pages/api/ai/*.ts vs
 * lib/ai/artemis.ts.
 */

import { prisma } from "@/lib/prisma";
import type { CartographyAgentRunResult, SubAgentTaskResult } from "@/lib/cartography/agentOrchestrator";

export type CartographyRunStatus = "completed" | "failed" | "review_pending";

/**
 * Rolls a run's overall status up from its sub-agents' individual outcomes. Pure and
 * unit-tested (tests/cartographyPersistRun.test.ts) — the DB write around it can't be tested
 * in this repo's harness (vitest.config.mts scopes unit tests to Prisma/Next-free modules
 * only), so keeping the actual decision logic here, not inline in a Prisma call, is what
 * makes it verifiable at all.
 */
export function computeRunStatus(tasks: SubAgentTaskResult[], candidateCount: number): CartographyRunStatus {
  const allFailed = tasks.length > 0 && tasks.every((t) => t.status === "failed");
  if (allFailed) return "failed";
  return candidateCount > 0 ? "review_pending" : "completed";
}

/**
 * Records a query screenCartographyQuery() rejected — the design doc's Query screening
 * section calls for logging every verdict, pass or reject, not just successful runs. Never
 * throws: an audit-log write failing must not turn into a 500 for a request that was already
 * correctly rejected for an unrelated reason.
 */
export async function persistScreeningRejection(params: {
  companyId: string;
  createdBy: string;
  icpDescription: string;
  reason: string;
}): Promise<void> {
  try {
    await prisma.cartographyRun.create({
      data: {
        company_id: params.companyId,
        created_by: params.createdBy,
        mode: "client_spec",
        icp_description: params.icpDescription,
        status: "failed",
        screening_note: params.reason,
        completed_at: new Date(),
      },
    });
  } catch (error) {
    // Supabase being unreachable (or any other write failure) must not mask the screening
    // rejection the caller already correctly received — same "degrade, don't break the
    // user-facing behavior" posture as lib/ai/artemis.ts's own error handling.
    console.error("[cartography] failed to persist screening rejection:", error);
  }
}

/**
 * Persists a completed agent run: one cartography_runs row, one cartography_run_tasks row
 * per sub-agent, and one cartography_companies + cartography_contacts row pair per
 * candidate (tagged with run_id/task_id — see docs/CARTOGRAPHY_DESIGN.md's Sub-agent
 * orchestration section). Returns null (not a thrown error) on failure so a DB outage never
 * costs the caller the candidates the agent already found — see the doc comment on the
 * catch below.
 */
export async function persistCartographyRun(params: {
  companyId: string;
  createdBy: string;
  icpDescription: string;
  result: CartographyAgentRunResult;
}): Promise<{ runId: string } | null> {
  const { companyId, createdBy, icpDescription, result } = params;
  const status = computeRunStatus(result.tasks, result.candidates.length);

  try {
    const run = await prisma.cartographyRun.create({
      data: {
        company_id: companyId,
        created_by: createdBy,
        mode: "client_spec",
        icp_description: icpDescription,
        status,
        completed_at: new Date(),
        cartography_run_tasks: {
          create: result.tasks.map((task) => ({
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

    const taskIdByMethod = new Map(run.cartography_run_tasks.map((t) => [t.method, t.id]));

    // Sequential, not Promise.all: candidate count is small (capped at 6 in the
    // orchestrator) and this keeps a partial-failure error message attributable to one
    // candidate instead of an ambiguous batch rejection.
    for (const candidate of result.candidates) {
      const company = await prisma.cartographyCompany.create({
        data: {
          company_id: companyId,
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
          company_id: companyId,
          cartography_company_id: company.id,
          run_id: run.id,
          task_id: taskIdByMethod.get(candidate.sourceMethod) ?? null,
          title: candidate.suggestedTitle || null,
          status: "candidate",
        },
      });
    }

    return { runId: run.id };
  } catch (error) {
    // A persistence failure (Supabase down, network blip, etc.) must not turn into a 500 for
    // a request whose actual expensive work — the Artemis call(s) — already succeeded. The
    // caller still gets its candidates; they just won't show up in the review queue until a
    // later run persists successfully. Logged so it's not silently lost either.
    console.error("[cartography] failed to persist agent run:", error);
    return null;
  }
}
