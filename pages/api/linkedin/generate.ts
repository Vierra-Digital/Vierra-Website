import { withSession } from "@/lib/api/withSession";
import { prisma } from "@/lib/prisma";
import { generateWithManus } from "@/lib/manus";
import { enrichKeywordWithAnswerThePublic } from "@/lib/answerThePublic";
import { getLinkedInContext, resolveClientIdForLinkedIn } from "@/lib/linkedinContext";
import { buildLinkedInManusPrompt, LINKEDIN_MANUS_SYSTEM_PROMPT } from "@/lib/manus/prompts/linkedin";

type SessionRole = "admin" | "staff" | "user";
type Mode = "manual" | "market_research";

type GenerateBody = {
  clientId?: string;
  mode?: Mode;
  extraContext?: string;
  postTopic?: string;
  keywords?: string;
  selectedAssetIds?: string[];
  revisionInstructions?: string;
};

type DraftResponse = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  suggestedKeyword: string;
  evidence: string[];
  recommendations: Array<{
    title: string;
    rationale: string;
    sampleCopy: string;
    projectedEngagementRate?: string;
  }>;
};

function sanitizeArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function parseManusJson(content: string): DraftResponse {
  try {
    const parsed = JSON.parse(content) as Partial<DraftResponse>;
    return {
      hook: parsed.hook || "Build trust with a practical, niche-specific LinkedIn insight.",
      body: parsed.body || content,
      cta: parsed.cta || "Comment if you want a tailored version for your niche.",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      suggestedKeyword: parsed.suggestedKeyword || "linkedin growth strategy",
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch {
    return {
      hook: "A data-backed LinkedIn post idea for your niche",
      body: content,
      cta: "Reply if you want us to generate the next angle.",
      hashtags: [],
      suggestedKeyword: "linkedin growth strategy",
      evidence: [],
      recommendations: [],
    };
  }
}

async function getLinkedInMetrics(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { user_id: true },
  });
  if (!client?.user_id) {
    return {
      attempts: 0,
      meetings: 0,
      clientsClosed: 0,
      revenue: 0,
      engagementRateProxy: 0,
    };
  }

  const trackerRows = await prisma.marketingTracker.findMany({
    where: {
      user_id: client.user_id,
      outreach: "linkedin",
    },
    orderBy: { updated_at: "desc" },
    take: 12,
    select: {
      attempt: true,
      meetings_set: true,
      clients_closed: true,
      revenue_cents: true,
    },
  });

  const summary = trackerRows.reduce(
    (acc, row) => {
      acc.attempts += row.attempt || 0;
      acc.meetings += row.meetings_set || 0;
      acc.clientsClosed += row.clients_closed || 0;
      acc.revenue += (row.revenue_cents || 0) / 100;
      return acc;
    },
    { attempts: 0, meetings: 0, clientsClosed: 0, revenue: 0 }
  );

  const engagementRateProxy = summary.attempts ? (summary.meetings / summary.attempts) * 100 : 0;
  return { ...summary, engagementRateProxy: Number(engagementRateProxy.toFixed(2)) };
}

export default withSession(async (req, res, session) => {
  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) return res.status(403).json({ message: "Forbidden" });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return res.status(400).json({ message: "Invalid session user." });

  const body = (req.body || {}) as GenerateBody;
  const mode: Mode = body.mode === "market_research" ? "market_research" : "manual";

  try {
    const clientId = await resolveClientIdForLinkedIn(
      { role, userId },
      typeof body.clientId === "string" ? body.clientId : null
    );
    if (!clientId) return res.status(400).json({ message: "clientId is required." });

    const context = await getLinkedInContext(clientId);
    if (!context) return res.status(404).json({ message: "Client context not found." });

    const selectedAssetIds = sanitizeArray(body.selectedAssetIds);
    const selectedAssets = context.imageAssets.filter((asset) => selectedAssetIds.includes(asset.id));
    const metrics = await getLinkedInMetrics(clientId);

    const seededKeyword = (body.keywords || context.overrides.keywords || "linkedin growth").trim();
    const enrichment = await enrichKeywordWithAnswerThePublic(seededKeyword);

    const prompt = buildLinkedInManusPrompt({
      mode,
      businessName: context.businessName,
      clientName: context.clientName,
      onboarding: {
        website: context.onboarding.website,
        industry: context.onboarding.industry,
        targetAudience: context.onboarding.targetAudience,
        socialMediaGoals: context.onboarding.socialMediaGoals,
        brandTone: context.onboarding.brandTone,
        businessSummary: context.onboarding.businessSummary,
      },
      overrides: {
        additionalBusinessInfo: context.overrides.additionalBusinessInfo,
        postTopic: context.overrides.postTopic,
        keywords: context.overrides.keywords,
        notes: context.overrides.notes,
      },
      liveInput: {
        extraContext: body.extraContext || "",
        postTopic: body.postTopic || "",
        keywords: body.keywords || "",
        revisionInstructions: body.revisionInstructions || "",
      },
      selectedAssetNames: selectedAssets.map((asset) => asset.name),
      metrics,
      benchmarkAngles: enrichment,
    });

    const generated = await generateWithManus([
      {
        role: "system",
        content: LINKEDIN_MANUS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ]);

    const draft = parseManusJson(generated);
    const enrichedKeywords = enrichment.map((item) => item.keyword);

    return res.status(200).json({
      mode,
      draft,
      enrichedKeywords,
      selectedAssets,
      metrics,
      benchmarkAngles: enrichment,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown generation error.";
    console.error("linkedin/generate", detail, error);

    let message = "Failed to generate LinkedIn content.";
    if (/MANUS_API_KEY is missing|MANUS_API_KEY is missing or empty/i.test(detail)) {
      message = "Manus configuration error: MANUS_API_KEY is missing or invalid.";
    } else if (/401|invalid token|malformed/i.test(detail)) {
      message = "Manus authentication failed. Check MANUS_API_KEY formatting and validity.";
    } else if (/404|Not Found/i.test(detail)) {
      message = "Manus endpoint was not found. Verify MANUS_API_URL and provider endpoint.";
    } else if (/empty response body/i.test(detail)) {
      message = "Manus returned an empty response. Please try again.";
    }

    return res.status(502).json({
      message,
      detail,
    });
  }
}, { methods: ["POST"] });

