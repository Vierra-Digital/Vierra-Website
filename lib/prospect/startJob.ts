import { prisma } from "@/lib/prisma";

const ARTEMIS_PROSPECT_URL = (process.env.ARTEMIS_PROSPECT_URL || "").replace(/\/+$/, "");
const ARTEMIS_PROSPECT_KEY = process.env.ARTEMIS_PROSPECT_KEY || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

export type StartProspectJobParams = {
  clientId: string;
  goal: string;
  requestedBy: string;
  partnershipTypes?: string[];
  n?: number;
  geo?: { city?: string; region?: string };
  excludeDomains?: string[];
};

export type StartProspectJobResult =
  | { ok: true; jobId: string }
  | { ok: false; status: number; message: string };

/**
 * Starts one /prospect job against Artemis and records it in artemis_prospect_jobs. Shared by
 * pages/api/prospect/start.ts (client-facing) and lib/cartography/prospectMethod.ts (Cartography's
 * Agentic mode, which submits through it exclusively now -- see pages/api/cartography/agent.ts).
 * Never throws: every failure mode (missing config, network error, non-202, no job_id) comes back
 * as `{ ok: false }` so callers can render a clean error rather than 500ing.
 */
export async function startProspectJob(params: StartProspectJobParams): Promise<StartProspectJobResult> {
  if (!ARTEMIS_PROSPECT_URL || !ARTEMIS_PROSPECT_KEY || !PUBLIC_BASE_URL) {
    return { ok: false, status: 503, message: "Artemis prospect is not configured." };
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, company_id: true, business_name: true },
  });
  if (!client) return { ok: false, status: 404, message: "Client not found." };

  // seeker_id is retired -- Artemis no longer looks up a profile on our behalf, so we build the
  // seeker object it replaced from what we already know about this client. targetAudience comes
  // from the company's latest onboarding answers (see pages/api/context/client.ts); we don't
  // track a structured city/region anywhere, so those only appear when the caller passed geo.
  const latestOnboarding = await prisma.onboardingSession.findFirst({
    where: { company_id: client.company_id },
    orderBy: { created_at: "desc" },
    select: { answers: true },
  });
  const onboardingAnswers =
    latestOnboarding?.answers && typeof latestOnboarding.answers === "object"
      ? (latestOnboarding.answers as Record<string, unknown>)
      : {};
  const wtAudience = typeof onboardingAnswers.targetAudience === "string" ? onboardingAnswers.targetAudience.trim() : "";

  const seeker: { name: string; wtAudience?: string; city?: string; region?: string } = {
    name: client.business_name,
  };
  if (wtAudience) seeker.wtAudience = wtAudience;
  if (params.geo?.city) seeker.city = params.geo.city;
  if (params.geo?.region) seeker.region = params.geo.region;

  const n = params.n ? Math.min(40, Math.max(1, Math.trunc(params.n))) : 8;

  let artemisRes: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    artemisRes = await fetch(`${ARTEMIS_PROSPECT_URL}/prospect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ARTEMIS_PROSPECT_KEY },
      body: JSON.stringify({
        query: params.goal,
        seeker,
        intent: "partner",
        partnership: { types: params.partnershipTypes && params.partnershipTypes.length ? params.partnershipTypes : ["referral"] },
        n,
        exclude: params.excludeDomains?.length ? { domains: params.excludeDomains } : undefined,
        callback_url: `${PUBLIC_BASE_URL}/api/prospect/callback`,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (error) {
    console.error("startProspectJob: request to Artemis failed", error);
    return { ok: false, status: 502, message: "Could not reach Artemis." };
  }

  if (artemisRes.status !== 202) {
    const body = await artemisRes.text().catch(() => "");
    console.error("startProspectJob: Artemis rejected the request", artemisRes.status, body);
    return { ok: false, status: artemisRes.status === 429 ? 429 : 502, message: "Artemis rejected the prospect request." };
  }

  const { job_id: jobId } = (await artemisRes.json()) as { job_id?: string };
  if (!jobId) return { ok: false, status: 502, message: "Artemis did not return a job id." };

  await prisma.artemisProspectJob.create({
    data: {
      id: jobId,
      client_id: client.id,
      company_id: client.company_id,
      requested_by: params.requestedBy,
      goal: params.goal,
      status: "queued",
    },
  });

  return { ok: true, jobId };
}
