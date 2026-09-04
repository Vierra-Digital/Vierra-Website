import { prisma } from "@/lib/prisma";

/** Which panel feature made the call. Matches the `endpoint` column on artemis_runs. */
export type ArtemisEndpoint = "compose" | "reply" | "rewrite" | "summarize" | "generate" | "research" | "blog";

interface LogRunInput {
  endpoint: ArtemisEndpoint;
  companyId?: string | null;
  userId?: string | null;
  brainId?: string;
  model?: string | null;
  latencyMs?: number;
  reviewItemId?: string | null;
  /** Omit for a successful run; pass the message to record a failure. */
  error?: string | null;
}

/**
 * Record one call to the box. Deliberately swallows its own failures: a usage log that can't be
 * written is a dashboard gap, not a reason to fail the generation the user is waiting on.
 */
export async function logArtemisRun(input: LogRunInput): Promise<void> {
  try {
    await prisma.artemisRun.create({
      data: {
        endpoint: input.endpoint,
        company_id: input.companyId ?? null,
        user_id: input.userId ?? null,
        brain_id: input.brainId ?? "vierra",
        model: input.model ?? process.env.ARTEMIS_MODEL ?? null,
        status: input.error ? "error" : "ok",
        error: input.error ? input.error.slice(0, 2000) : null,
        latency_ms: input.latencyMs ?? null,
        review_item_id: input.reviewItemId ?? null,
      },
    });
  } catch (error) {
    console.error("[artemis] could not record run", error);
  }
}

/** Wrap a call to the box so it is timed and logged whichever way it goes. */
export async function withRunLog<T>(
  meta: Omit<LogRunInput, "latencyMs" | "error">,
  run: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const startedAt = Date.now();
  const result = await run();
  await logArtemisRun({
    ...meta,
    latencyMs: Date.now() - startedAt,
    error: result.ok ? null : result.error,
  });
  return result;
}
