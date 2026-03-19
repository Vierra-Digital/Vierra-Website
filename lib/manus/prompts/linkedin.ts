export type LinkedInPromptMode = "manual" | "market_research";

export type LinkedInPromptInput = {
  mode: LinkedInPromptMode;
  businessName: string;
  clientName: string;
  onboarding: {
    website: string;
    industry: string;
    targetAudience: string;
    socialMediaGoals: string;
    brandTone: string;
    businessSummary: string;
  };
  overrides: {
    additionalBusinessInfo: string;
    postTopic: string;
    keywords: string;
    notes: string;
  };
  liveInput: {
    extraContext: string;
    postTopic: string;
    keywords: string;
    revisionInstructions: string;
  };
  selectedAssetNames: string[];
  metrics: {
    attempts: number;
    meetings: number;
    clientsClosed: number;
    revenue: number;
    engagementRateProxy: number;
  };
  benchmarkAngles: Array<{ keyword: string; title: string; angle: string }>;
};

const DEFAULT_AVATAR_PAINPOINT_CONTEXT = [
  "Optional copywriting guidance (use only when relevant):",
  "- Write to one specific avatar, not a broad audience.",
  "- Use concrete specificity about that avatar's role, context, and constraints.",
  "- Focus on pains and frustrations in their current state before presenting solutions.",
  "- Prioritize high-friction pain points: what annoys them, what they fear, and what keeps them up at night.",
  "- Mirror the avatar's language for pains and frustrations where possible.",
  "- Show empathy first, then move to practical clarity and next steps.",
  "- Keep tone aligned to the brand voice while staying direct and useful.",
].join("\n");

function valueOrNA(value: string | undefined) {
  const trimmed = (value || "").trim();
  return trimmed || "N/A";
}

export const LINKEDIN_MANUS_SYSTEM_PROMPT =
  "You are a B2B LinkedIn strategist. Return only JSON, no markdown.";

export function buildLinkedInManusPrompt(input: LinkedInPromptInput) {
  const benchmarkLines =
    input.benchmarkAngles.map((item) => `- ${item.keyword}: ${item.title} (${item.angle})`).join("\n") || "- N/A";

  return `
You are generating a LinkedIn posting output for client outreach.
Return STRICT JSON only with shape:
{
  "hook": string,
  "body": string,
  "cta": string,
  "hashtags": string[],
  "suggestedKeyword": string,
  "evidence": string[],
  "recommendations": [{"title": string, "rationale": string, "sampleCopy": string, "projectedEngagementRate": string}]
}

Mode: ${input.mode}
Business name: ${valueOrNA(input.businessName)}
Client name: ${valueOrNA(input.clientName)}
Onboarding context:
- Website: ${valueOrNA(input.onboarding.website)}
- Industry: ${valueOrNA(input.onboarding.industry)}
- Target audience: ${valueOrNA(input.onboarding.targetAudience)}
- Social goals: ${valueOrNA(input.onboarding.socialMediaGoals)}
- Brand tone: ${valueOrNA(input.onboarding.brandTone)}
- Business summary: ${valueOrNA(input.onboarding.businessSummary)}
Saved overrides:
- Additional business info: ${valueOrNA(input.overrides.additionalBusinessInfo)}
- Preferred topic: ${valueOrNA(input.overrides.postTopic)}
- Saved keywords: ${valueOrNA(input.overrides.keywords)}
- Notes: ${valueOrNA(input.overrides.notes)}
Live input:
- Extra context: ${valueOrNA(input.liveInput.extraContext)}
- Post topic: ${valueOrNA(input.liveInput.postTopic)}
- Keywords: ${valueOrNA(input.liveInput.keywords)}
- Revision instructions: ${valueOrNA(input.liveInput.revisionInstructions)}
Selected image assets: ${input.selectedAssetNames.join(", ") || "None"}

Client historical LinkedIn performance (proxy from tracker data):
- Attempts: ${input.metrics.attempts}
- Meetings set: ${input.metrics.meetings}
- Clients closed: ${input.metrics.clientsClosed}
- Revenue: ${input.metrics.revenue}
- Engagement rate proxy: ${input.metrics.engagementRateProxy}%

Public benchmark keyword angles:
${benchmarkLines}

Default context:
${DEFAULT_AVATAR_PAINPOINT_CONTEXT}

If mode is market_research:
- include at least 4 ranked recommendations with analytical rationale
- explicitly reference impressions, likes, comments, reposts, and engagement-rate style reasoning in evidence list
If mode is manual:
- include one polished post draft and 2 backup post ideas in recommendations
`.trim();
}
