import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Cheap "has anything changed?" fingerprint per keep-alive panel section, so the client can
 * decide whether a section it already has mounted (see pages/panel.tsx's visitedSections) needs
 * a real refetch or can keep showing what it has. Each fingerprint is a row count plus the latest
 * timestamp available on that table — count catches deletes, the timestamp catches adds/edits —
 * scoped to the caller's company where the table is company-scoped (blog posts aren't).
 */
export default withAuth(
  async (req, res, session) => {
    const companyId = session.companyId;

    const [
      membershipCount,
      membershipLatest,
      invitationCount,
      invitationLatest,
      fileCount,
      fileLatest,
      marketingCount,
      marketingLatest,
      clientOutreachCount,
      clientOutreachLatest,
      boardCount,
      boardLatest,
      taskCount,
      taskLatest,
      blogCount,
      blogLatest,
    ] = await Promise.all([
      prisma.companyMembership.count({ where: { company_id: companyId } }),
      prisma.companyMembership.aggregate({ where: { company_id: companyId }, _max: { joined_at: true } }),
      prisma.invitation.count({ where: { company_id: companyId } }),
      prisma.invitation.aggregate({ where: { company_id: companyId }, _max: { created_at: true } }),
      prisma.storedFile.count({ where: { company_id: companyId } }),
      prisma.storedFile.aggregate({ where: { company_id: companyId }, _max: { created_at: true } }),
      prisma.marketingTracker.count({ where: { company_id: companyId } }),
      prisma.marketingTracker.aggregate({ where: { company_id: companyId }, _max: { updated_at: true } }),
      prisma.clientOutreachTracker.count({ where: { company_id: companyId } }),
      prisma.clientOutreachTracker.aggregate({ where: { company_id: companyId }, _max: { updated_at: true } }),
      prisma.projectBoard.count({ where: { company_id: companyId } }),
      prisma.projectBoard.aggregate({ where: { company_id: companyId }, _max: { created_at: true } }),
      prisma.projectTask.count({ where: { company_id: companyId } }),
      prisma.projectTask.aggregate({ where: { company_id: companyId }, _max: { updated_at: true } }),
      prisma.blogPost.count(),
      prisma.blogPost.aggregate({ _max: { updated_date: true, created_at: true } }),
    ]);

    const stamp = (...parts: Array<number | string | Date | null | undefined>) =>
      parts.map((p) => (p instanceof Date ? p.toISOString() : String(p ?? ""))).join(":");

    res.status(200).json({
      team: stamp(membershipCount, membershipLatest._max.joined_at, invitationCount, invitationLatest._max.created_at),
      files: stamp(fileCount, fileLatest._max.created_at),
      outreach: stamp(
        marketingCount,
        marketingLatest._max.updated_at,
        clientOutreachCount,
        clientOutreachLatest._max.updated_at
      ),
      projects: stamp(boardCount, boardLatest._max.created_at, taskCount, taskLatest._max.updated_at),
      blog: stamp(blogCount, blogLatest._max.updated_date, blogLatest._max.created_at),
    });
  },
  { methods: ["GET"] }
);
