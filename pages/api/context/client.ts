import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CONTEXT_CATEGORY_LABELS, CONTEXT_FIELDS, CONTEXT_FIELD_KEYS, type ContextCategoryId } from "@/lib/contextFields";

type SessionRole = "admin" | "staff" | "user";

type ContextOverrides = {
  additionalBusinessInfo?: string;
  postTopic?: string;
  keywords?: string;
  notes?: string;
};

type EditableAnswers = Record<string, string>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

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

function normalizeEditableAnswers(answers: unknown): EditableAnswers {
  const source = typeof answers === "object" && answers ? (answers as Record<string, unknown>) : {};
  return CONTEXT_FIELDS.reduce<EditableAnswers>((acc, field) => {
    acc[field.key] = asString(source[field.key]);
    return acc;
  }, {});
}

function buildCategories(editableAnswers: EditableAnswers) {
  const categories = new Map<ContextCategoryId, { id: ContextCategoryId; label: string; fields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea";
    rows?: number;
    value: string;
  }> }>();

  (Object.keys(CONTEXT_CATEGORY_LABELS) as ContextCategoryId[]).forEach((id) => {
    categories.set(id, { id, label: CONTEXT_CATEGORY_LABELS[id], fields: [] });
  });

  CONTEXT_FIELDS.forEach((field) => {
    const category = categories.get(field.category);
    if (!category) return;
    category.fields.push({
      key: field.key,
      label: field.label,
      type: field.type,
      rows: field.rows,
      value: editableAnswers[field.key] || "",
    });
  });

  return Array.from(categories.values());
}

function isImageFile(name: string, fileType: string) {
  const lowerName = name.toLowerCase();
  const lowerType = fileType.toLowerCase();
  return (
    ["png", "jpg", "jpeg"].includes(lowerType) ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  );
}

async function resolveClientId(
  req: NextApiRequest,
  role: SessionRole,
  sessionUserId: number,
  sessionEmail?: string
) {
  if (role === "user") {
    const client = await prisma.client.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    if (client?.id) return client.id;

    if (sessionEmail) {
      const fallbackClient = await prisma.client.findUnique({
        where: { email: sessionEmail.toLowerCase() },
        select: { id: true, userId: true },
      });
      if (fallbackClient?.id) {
        if (!fallbackClient.userId) {
          await prisma.client.update({
            where: { id: fallbackClient.id },
            data: { userId: sessionUserId },
          });
        }
        return fallbackClient.id;
      }
    }
    return null;
  }

  const rawClientId = Array.isArray(req.query.clientId) ? req.query.clientId[0] : req.query.clientId;
  if (!rawClientId || typeof rawClientId !== "string") return null;
  return rawClientId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const rawUserId = (session.user as { id?: number | string }).id;
  const sessionEmail = (session.user as { email?: string | null }).email || undefined;
  const sessionUserId = rawUserId != null ? Number(rawUserId) : NaN;
  if (Number.isNaN(sessionUserId)) {
    return res.status(400).json({ message: "Invalid session user." });
  }

  const clientId = await resolveClientId(req, role, sessionUserId, sessionEmail);
  if (!clientId) return res.status(400).json({ message: "clientId is required." });

  if (req.method === "GET") {
    try {
      const [client, latestSession, files] = await Promise.all([
        prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true, email: true, businessName: true },
        }),
        prisma.onboardingSession.findFirst({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          select: { id: true, answers: true },
        }),
        prisma.storedFile.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, fileType: true, signingTokenId: true, createdAt: true },
        }),
      ]);

      if (!client) return res.status(404).json({ message: "Client not found." });

      const answersObject =
        latestSession?.answers && typeof latestSession.answers === "object"
          ? (latestSession.answers as Record<string, unknown>)
          : {};

      const overrides =
        typeof answersObject.__linkedinContextOverrides === "object" && answersObject.__linkedinContextOverrides
          ? (answersObject.__linkedinContextOverrides as ContextOverrides)
          : {};
      const editableAnswers = normalizeEditableAnswers(answersObject);

      const assets = files
        .filter((f) => isImageFile(f.name, f.fileType))
        .map((f) => ({
          id: f.id,
          name: f.name,
          fileType: f.fileType,
          signingTokenId: f.signingTokenId,
          createdAt: f.createdAt,
          previewUrl: f.signingTokenId
            ? `/files/preview?tokenId=${encodeURIComponent(f.signingTokenId)}&name=${encodeURIComponent(f.name)}`
            : null,
        }));

      return res.status(200).json({
        client,
        sessionId: latestSession?.id ?? null,
        onboarding: normalizeOnboardingAnswers(latestSession?.answers),
        editableAnswers,
        categories: buildCategories(editableAnswers),
        overrides,
        assets,
      });
    } catch (error) {
      console.error("context/client GET", error);
      return res.status(500).json({ message: "Failed to load context." });
    }
  }

  if (req.method === "PUT") {
    try {
      const body = req.body ?? {};
      const rawEditableAnswers =
        body.editableAnswers && typeof body.editableAnswers === "object"
          ? (body.editableAnswers as Record<string, unknown>)
          : null;
      const hasOverridePayload =
        "additionalBusinessInfo" in body || "postTopic" in body || "keywords" in body || "notes" in body;

      const latestSession = await prisma.onboardingSession.findFirst({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        select: { id: true, answers: true },
      });

      if (!latestSession) {
        return res.status(404).json({ message: "No onboarding session found for this client." });
      }

      const baseAnswers =
        latestSession.answers && typeof latestSession.answers === "object"
          ? (latestSession.answers as Record<string, unknown>)
          : {};
      const existingOverrides =
        typeof baseAnswers.__linkedinContextOverrides === "object" && baseAnswers.__linkedinContextOverrides
          ? (baseAnswers.__linkedinContextOverrides as ContextOverrides)
          : {};

      const updatedAnswers: Record<string, unknown> = {
        ...baseAnswers,
      };

      if (hasOverridePayload) {
        const overrides: ContextOverrides = {
          additionalBusinessInfo: asString(body.additionalBusinessInfo).trim(),
          postTopic: asString(body.postTopic).trim(),
          keywords: asString(body.keywords).trim(),
          notes: asString(body.notes).trim(),
        };
        updatedAnswers.__linkedinContextOverrides = overrides;
      } else if (existingOverrides && Object.keys(existingOverrides).length > 0) {
        updatedAnswers.__linkedinContextOverrides = existingOverrides;
      }

      if (rawEditableAnswers) {
        Object.entries(rawEditableAnswers).forEach(([key, value]) => {
          if (!CONTEXT_FIELD_KEYS.has(key)) return;
          updatedAnswers[key] = asString(value).trim();
        });
      }

      await prisma.onboardingSession.update({
        where: { id: latestSession.id },
        data: {
          answers: updatedAnswers as Prisma.InputJsonValue,
          lastUpdatedAt: new Date(),
        },
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("context/client PUT", error);
      return res.status(500).json({ message: "Failed to save context." });
    }
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ message: "Method Not Allowed" });
}

