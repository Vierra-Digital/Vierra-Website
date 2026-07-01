import { Prisma } from "@prisma/client";
import { withSession } from "@/lib/api/withSession";
import { prisma } from "@/lib/prisma";
import { resolveClientIdForLinkedIn } from "@/lib/linkedinContext";

type SessionRole = "admin" | "staff" | "user";
type TargetType = "personal" | "company";

type ScheduleBody = {
  clientId?: string;
  targetType?: TargetType;
  companyId?: string;
  postText?: string;
  scheduledFor?: string;
};

type ScheduledItem = {
  id: string;
  createdAt: string;
  scheduledFor: string;
  targetType: TargetType;
  companyId?: string;
  postText: string;
  status: "scheduled";
};

export default withSession(async (req, res, session) => {
  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) return res.status(403).json({ message: "Forbidden" });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return res.status(400).json({ message: "Invalid session user." });

  const body = (req.body || {}) as ScheduleBody;
  const postText = (body.postText || "").trim();
  if (!postText) return res.status(400).json({ message: "postText is required." });

  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
  if (!scheduledFor || Number.isNaN(scheduledFor.valueOf())) {
    return res.status(400).json({ message: "scheduledFor must be a valid datetime." });
  }
  if (scheduledFor.getTime() < Date.now()) {
    return res.status(400).json({ message: "scheduledFor must be in the future." });
  }

  const clientId = await resolveClientIdForLinkedIn(
      { role, userId },
      typeof body.clientId === "string" ? body.clientId : null
    );
    if (!clientId) return res.status(400).json({ message: "clientId is required." });

    const latestSession = await prisma.onboardingSession.findFirst({
      where: { client_id: clientId },
      orderBy: { created_at: "desc" },
      select: { id: true, answers: true },
    });

    if (!latestSession) return res.status(404).json({ message: "No onboarding session found for this client." });

    const answersObject =
      latestSession.answers && typeof latestSession.answers === "object"
        ? (latestSession.answers as Record<string, unknown>)
        : {};

    const currentSchedule = Array.isArray(answersObject.__linkedinScheduledPosts)
      ? (answersObject.__linkedinScheduledPosts as ScheduledItem[])
      : [];

    const scheduledItem: ScheduledItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
      scheduledFor: scheduledFor.toISOString(),
      targetType: body.targetType === "company" ? "company" : "personal",
      companyId: body.companyId?.trim() || undefined,
      postText,
      status: "scheduled",
    };

    await prisma.onboardingSession.update({
      where: { id: latestSession.id },
      data: {
        answers: ({
          ...answersObject,
          __linkedinScheduledPosts: [scheduledItem, ...currentSchedule].slice(0, 50),
        } as unknown) as Prisma.InputJsonValue,
      },
    });

    return res.status(200).json({
      ok: true,
      scheduled: scheduledItem,
    });
}, { methods: ["POST"] });

