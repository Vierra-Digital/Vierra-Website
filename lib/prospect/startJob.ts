import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/api/parsing";
import { mapPrismaError } from "@/lib/api/prismaError";

const ARTEMIS_PROSPECT_URL = (process.env.ARTEMIS_PROSPECT_URL || "").replace(/\/+$/, "");
const ARTEMIS_PROSPECT_KEY = process.env.ARTEMIS_PROSPECT_KEY || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

export type StartProspectJobParams = {
  // Either identifies the seeker. clientId (when given) takes precedence and companyId is derived
  // from it; companyId alone is enough for a company with no onboarded Client yet (see
  // lib/cartography/prospectMethod.ts).
  clientId?: string | null;
  companyId?: string;
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

  // clients.id / companies.id are @db.Uuid columns — the findUnique calls below would otherwise
  // throw (P2007) on a malformed id rather than the clean 404 this function means to answer for
  // any id that isn't a real row's, breaking the "never throws" contract this function documents.
  // clientId can come straight from request bodies this function doesn't control (see
  // pages/api/prospect/start.ts's member-session path), so it isn't already guaranteed shaped the
  // way Cartography's companyId is (see lib/api/targetCompany.ts).
  if (params.clientId && !isUuid(params.clientId)) return { ok: false, status: 404, message: "Client not found." };
  if (!params.clientId && params.companyId && !isUuid(params.companyId)) {
    return { ok: false, status: 404, message: "Company not found." };
  }

  let companyId: string;
  let businessName: string;
  if (params.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { id: true, company_id: true, business_name: true },
    });
    if (!client) return { ok: false, status: 404, message: "Client not found." };
    companyId = client.company_id;
    businessName = client.business_name;
  } else if (params.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: params.companyId },
      select: { id: true, name: true },
    });
    if (!company) return { ok: false, status: 404, message: "Company not found." };
    companyId = company.id;
    businessName = company.name;
  } else {
    return { ok: false, status: 400, message: "clientId or companyId is required." };
  }

  // seeker_id is retired -- Artemis no longer looks up a profile on our behalf, so we build the
  // seeker object it replaced from what we already know about this company. targetAudience comes
  // from the company's latest onboarding answers (see pages/api/context/client.ts); we don't
  // track a structured city/region anywhere, so those only appear when the caller passed geo.
  const latestOnboarding = await prisma.onboardingSession.findFirst({
    where: { company_id: companyId },
    orderBy: { created_at: "desc" },
    select: { answers: true },
  });
  const onboardingAnswers =
    latestOnboarding?.answers && typeof latestOnboarding.answers === "object"
      ? (latestOnboarding.answers as Record<string, unknown>)
      : {};
  const wtAudience = typeof onboardingAnswers.targetAudience === "string" ? onboardingAnswers.targetAudience.trim() : "";

  const seeker: { name: string; wtAudience?: string; city?: string; region?: string } = {
    name: businessName,
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

  let jobId: string | undefined;
  try {
    ({ job_id: jobId } = (await artemisRes.json()) as { job_id?: string });
  } catch (error) {
    console.error("startProspectJob: Artemis returned a malformed response body", error);
    return { ok: false, status: 502, message: "Artemis returned a malformed response." };
  }
  if (!jobId) return { ok: false, status: 502, message: "Artemis did not return a job id." };

  try {
    await prisma.artemisProspectJob.create({
      data: {
        id: jobId,
        client_id: params.clientId ?? null,
        company_id: companyId,
        requested_by: params.requestedBy,
        goal: params.goal,
        status: "queued",
      },
    });
  } catch (error) {
    // Artemis already accepted the job by this point (status 202 above) — a collision on jobId
    // (a retried callback resending the same job_id) or a company/client that vanished between the
    // lookups above and this insert are both real possibilities, and this function's contract
    // ("never throws") means neither can be allowed to bubble past here as an uncaught exception.
    console.error("startProspectJob: failed to record the job Artemis already accepted", jobId, error);
    const mapped = mapPrismaError(error);
    return { ok: false, status: mapped?.status ?? 500, message: mapped?.message ?? "Failed to record the prospect job." };
  }

  return { ok: true, jobId };
}
