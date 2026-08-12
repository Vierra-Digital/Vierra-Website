import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import type { Availability } from "@/lib/booking/slots";
import type { Prisma } from "@prisma/client";

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "meeting";
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

// Hosts must set their own business hours — no silent default (previously fell back to a fixed
// Mon-Fri 14:00-22:00 UTC window when omitted, which is wrong for most hosts' actual availability).
function parseAvailability(input: unknown): Availability | null {
  if (!input || typeof input !== "object") return null;
  const { days, startMinutes, endMinutes } = input as Record<string, unknown>;
  if (!Array.isArray(days) || days.length === 0) return null;
  if (!days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) return null;
  if ((startMinutes as number) < 0 || (endMinutes as number) > 24 * 60 || (startMinutes as number) >= (endMinutes as number)) return null;
  return { days: days as number[], startMinutes: startMinutes as number, endMinutes: endMinutes as number };
}

/** List / create the caller's meeting booking links. */
export default withAuth(
  async (req, res, session) => {
    const userId = session.user.id;

    if (req.method === "GET") {
      const links = await prisma.bookingLink.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
      });
      // Flag links whose Google token needs reconnecting (set by syncBookingAttendance on a
      // failed refresh) so the UI can prompt without adding a whole separate status endpoint.
      const accountEmails = Array.from(new Set(links.map((l) => l.account_email)));
      const tokens = accountEmails.length
        ? await prisma.platformToken.findMany({
            where: { user_id: userId, platform: { in: accountEmails.map((e) => `gmail:${e}`) } },
            select: { platform: true, meta: true },
          })
        : [];
      const needsReconnectByEmail = new Map(
        tokens.map((t) => [t.platform.replace(/^gmail:/, ""), Boolean((t.meta as { needsReconnect?: boolean } | null)?.needsReconnect)])
      );
      res.status(200).json({
        links: links.map((l) => ({ ...l, needsReconnect: needsReconnectByEmail.get(l.account_email) || false })),
      });
      return;
    }

    const accountEmail = asStr(req.body?.accountEmail).trim().toLowerCase();
    const title = asStr(req.body?.title).trim();
    if (!accountEmail || !title) {
      res.status(400).json({ message: "accountEmail and title are required." });
      return;
    }

    const provider = asStr(req.body?.provider).trim() || "google_meet";
    if (!["google_meet", "zoom", "microsoft_teams"].includes(provider)) {
      res.status(400).json({ message: "Unsupported provider." });
      return;
    }
    const acknowledged = Boolean(req.body?.acknowledgeNoAttendanceAnalytics);

    // Free/busy always comes from the host's Google Calendar regardless of video provider
    // (see DESIGN.md §14 deviations — calendar connection and video-provider connection are
    // orthogonal), so accountEmail's Gmail connection is required either way.
    if (provider === "google_meet") {
      // Personal Gmail accounts never get Meet attendance data (Workspace-only API) — require
      // an explicit acknowledgement rather than silently degrading (MEETING_TRACKING_QUESTIONS.md §2).
      const tokenRow = await prisma.platformToken.findUnique({
        where: { user_id_platform: { user_id: userId, platform: `gmail:${accountEmail}` } },
        select: { meta: true },
      });
      const isWorkspace = Boolean((tokenRow?.meta as { isWorkspaceOrOrgAccount?: boolean } | null)?.isWorkspaceOrOrgAccount);
      if (!isWorkspace && !acknowledged) {
        res.status(409).json({
          message: "This Gmail account isn't on Google Workspace, so meeting attendance can't be tracked automatically for it.",
          code: "personal_gmail_no_attendance",
        });
        return;
      }
    } else {
      // Zoom/Teams need their own connection (see pages/api/zoom/initiate.ts, pages/api/msteams/initiate.ts)
      // in addition to the Google Calendar one, and attendance-report access is plan/admin-consent
      // gated (MEETING_TRACKING_QUESTIONS.md §3) — warn the same way as the personal-Gmail case.
      const platformPrefix = provider === "zoom" ? "zoom:" : "msteams:";
      const providerName = provider === "zoom" ? "Zoom" : "Microsoft Teams";
      const providerToken = await prisma.platformToken.findFirst({
        where: { user_id: userId, platform: { startsWith: platformPrefix } },
        select: { meta: true },
      });
      if (!providerToken) {
        res.status(409).json({ message: `Connect a ${providerName} account first.`, code: "provider_not_connected" });
        return;
      }
      const attendanceAvailable = Boolean((providerToken.meta as { attendanceReportsAvailable?: boolean } | null)?.attendanceReportsAvailable);
      if (!attendanceAvailable && !acknowledged) {
        res.status(409).json({
          message: `This ${providerName} account isn't on a plan/permission level with attendance reports, so we can only track that meetings were booked, not whether they were attended, via CSV import instead.`,
          code: "provider_no_attendance",
        });
        return;
      }
    }

    // Team (round-robin) link: one shared page for the whole company, per
    // MEETING_TRACKING_QUESTIONS.md §25/§29 ("an organization has one singular booking page").
    // Reuses the existing Company/CompanyMembership model rather than a new Organization concept.
    let companyId: string | null = null;
    if (Boolean(req.body?.team)) {
      const membership = await prisma.companyMembership.findUnique({ where: { user_id: userId }, select: { company_id: true } });
      if (!membership) {
        res.status(400).json({ message: "You must be part of a company to create a team booking link." });
        return;
      }
      companyId = membership.company_id;
    }

    const availability = parseAvailability(req.body?.availability);
    if (!availability) {
      res.status(400).json({ message: "Set your business hours (at least one day, with a start time before the end time)." });
      return;
    }

    const durationRaw = Number(req.body?.durationMinutes);
    const bufferRaw = Number(req.body?.bufferMinutes);
    const link = await prisma.bookingLink.create({
      data: {
        user_id: userId,
        account_email: accountEmail,
        slug: slugify(title),
        title,
        description: asStr(req.body?.description).trim() || null,
        duration_minutes: Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(Math.floor(durationRaw), 480) : 30,
        buffer_minutes: Number.isFinite(bufferRaw) && bufferRaw >= 0 ? Math.min(Math.floor(bufferRaw), 240) : 0,
        timezone: asStr(req.body?.timezone).trim() || "UTC",
        availability: availability as unknown as Prisma.InputJsonValue,
        provider,
        company_id: companyId,
      },
    });
    res.status(200).json({ link });
  },
  { methods: ["GET", "POST"] }
);
