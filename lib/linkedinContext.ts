import { prisma } from "@/lib/prisma";

type SessionRole = "admin" | "staff" | "user";

type SessionInfo = {
  role: SessionRole;
  userId: string;
};

export type LinkedInContextPayload = {
  clientId: string;
  clientName: string;
  businessName: string;
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
  imageAssets: Array<{ id: string; name: string; fileType: string; tokenId: string }>;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

function normalizeOnboardingAnswers(answers: unknown) {
  const source = typeof answers === "object" && answers ? (answers as Record<string, unknown>) : {};
  return {
    website: asString(source.website),
    industry: asString(source.industry),
    targetAudience: asString(source.targetAudience),
    socialMediaGoals: asString(source.socialMediaGoals),
    brandTone: asString(source.brandTone),
    businessSummary:
      asString(source.businessSummary) ||
      asString(source.businessDescription) ||
      asString(source.companyDescription),
  };
}

function isImage(fileType: string, name: string) {
  const lowerType = fileType.toLowerCase();
  const lowerName = name.toLowerCase();
  return (
    ["png", "jpg", "jpeg"].includes(lowerType) ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  );
}

export async function resolveClientIdForLinkedIn(session: SessionInfo, clientIdFromRequest?: string | null) {
  if (session.role === "user") {
    const client = await prisma.client.findUnique({
      where: { user_id: session.userId },
      select: { id: true },
    });
    return client?.id ?? null;
  }

  return clientIdFromRequest || null;
}

export async function getLinkedInContext(clientId: string): Promise<LinkedInContextPayload | null> {
  const [client, latestSession, assets] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, business_name: true },
    }),
    prisma.onboardingSession.findFirst({
      where: { client_id: clientId },
      orderBy: { created_at: "desc" },
      select: { answers: true },
    }),
    prisma.storedFile.findMany({
      where: { client_id: clientId },
      orderBy: { created_at: "desc" },
      select: { id: true, name: true, file_type: true, signing_token_id: true },
    }),
  ]);

  if (!client) return null;

  const answersObject =
    latestSession?.answers && typeof latestSession.answers === "object"
      ? (latestSession.answers as Record<string, unknown>)
      : {};

  const overridesObject =
    typeof answersObject.__linkedinContextOverrides === "object" && answersObject.__linkedinContextOverrides
      ? (answersObject.__linkedinContextOverrides as Record<string, unknown>)
      : {};

  return {
    clientId: client.id,
    clientName: client.name,
    businessName: client.business_name,
    onboarding: normalizeOnboardingAnswers(latestSession?.answers),
    overrides: {
      additionalBusinessInfo: asString(overridesObject.additionalBusinessInfo),
      postTopic: asString(overridesObject.postTopic),
      keywords: asString(overridesObject.keywords),
      notes: asString(overridesObject.notes),
    },
    imageAssets: assets
      .filter((asset) => isImage(asset.file_type, asset.name))
      .map((asset) => ({
        id: asset.id,
        name: asset.name,
        fileType: asset.file_type,
        tokenId: asset.signing_token_id ?? "",
      })),
  };
}
