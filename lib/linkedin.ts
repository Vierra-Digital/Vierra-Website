import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type LinkedInHttpMethod = "GET" | "POST";

export type LinkedInPostTarget =
  | { type: "personal"; personId: string }
  | { type: "company"; organizationId: string };

type LinkedInRequestOptions = {
  method?: LinkedInHttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  version?: string;
};

type SessionRole = "admin" | "staff" | "user";

function buildHeaders(token: string, version: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": version,
    "X-Restli-Protocol-Version": "2.0.0",
    ...(extra || {}),
  };
}

async function getEncryptedUserLinkedInToken(userId: string) {
  return prisma.platformToken.findUnique({
    where: { user_id_platform: { user_id: userId, platform: "linkedin" } },
    select: { access_token: true },
  });
}

async function getLatestOnboardingLinkedInToken(clientId: string) {
  return prisma.onboardingPlatformToken.findFirst({
    where: {
      platform: "linkedin",
      onboarding_sessions: { client_id: clientId },
    },
    orderBy: { updated_at: "desc" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });
}

async function getClientForSessionUser(userId: string) {
  return prisma.client.findUnique({
    where: { user_id: userId },
    select: { id: true },
  });
}

export async function resolveLinkedInTokenForContext(params: {
  sessionUserId: string;
  role: SessionRole;
  clientId?: string | null;
}) {
  const { sessionUserId, role, clientId } = params;

  const ownToken = await getEncryptedUserLinkedInToken(sessionUserId);
  if (ownToken && !clientId) return decrypt(ownToken.access_token);

  if (role === "user") {
    if (ownToken) return decrypt(ownToken.access_token);
    const client = await getClientForSessionUser(sessionUserId);
    if (!client) return null;
    const onboardingToken = await getLatestOnboardingLinkedInToken(client.id);
    return onboardingToken ? decrypt(onboardingToken.access_token) : null;
  }

  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, user_id: true },
    });
    if (!client) return null;

    if (client.user_id) {
      const clientUserToken = await getEncryptedUserLinkedInToken(client.user_id);
      if (clientUserToken) return decrypt(clientUserToken.access_token);
    }

    const onboardingToken = await getLatestOnboardingLinkedInToken(client.id);
    if (onboardingToken) {
      if (client.user_id) {
        await prisma.platformToken.upsert({
          where: { user_id_platform: { user_id: client.user_id, platform: "linkedin" } },
          update: {
            access_token: onboardingToken.access_token,
            refresh_token: onboardingToken.refresh_token ?? undefined,
            expires_at: onboardingToken.expires_at ?? undefined,
          },
          create: {
            user_id: client.user_id,
            platform: "linkedin",
            access_token: onboardingToken.access_token,
            refresh_token: onboardingToken.refresh_token ?? undefined,
            expires_at: onboardingToken.expires_at ?? undefined,
          },
        });
      }
      return decrypt(onboardingToken.access_token);
    }
  }

  return ownToken ? decrypt(ownToken.access_token) : null;
}

export async function linkedInRequest<T>(
  token: string,
  path: string,
  options: LinkedInRequestOptions = {}
): Promise<T> {
  const method = options.method || "GET";
  const version = options.version || "202405";
  const response = await fetch(`https://api.linkedin.com${path}`, {
    method,
    headers: buildHeaders(token, version, {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LinkedIn ${method} ${path} failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function resolvePersonalTarget(token: string): Promise<{ type: "personal"; personId: string }> {
  const userInfo = await linkedInRequest<{ sub?: string; id?: string }>(token, "/v2/userinfo");
  const personId = userInfo.sub || userInfo.id;
  if (!personId) {
    throw new Error("Unable to resolve LinkedIn personal account id.");
  }
  return { type: "personal", personId };
}

export async function resolveCompanyTargets(token: string) {
  const personal = await resolvePersonalTarget(token);
  const personId = personal.personId;
  if (!personId) return [];

  const acl = await linkedInRequest<{
    elements?: Array<{
      organization?: string;
      roleAssignee?: string;
      role?: string;
      state?: string;
    }>;
  }>(
    token,
    `/v2/organizationalEntityAcls?q=roleAssignee&roleAssignee=urn:li:person:${personId}&state=APPROVED`
  );

  const organizations = (acl.elements || [])
    .map((item) => item.organization)
    .filter((urn): urn is string => typeof urn === "string" && urn.startsWith("urn:li:organization:"));

  const uniqueOrgIds = Array.from(new Set(organizations.map((urn) => urn.split(":").pop() || ""))).filter(Boolean);
  if (uniqueOrgIds.length === 0) return [];

  const orgs = await Promise.all(
    uniqueOrgIds.map(async (orgId) => {
      try {
        const details = await linkedInRequest<{ id?: string; localizedName?: string }>(
          token,
          `/v2/organizations/${orgId}`
        );
        return {
          id: orgId,
          name: details.localizedName || `Organization ${orgId}`,
        };
      } catch {
        return {
          id: orgId,
          name: `Organization ${orgId}`,
        };
      }
    })
  );

  return orgs;
}
