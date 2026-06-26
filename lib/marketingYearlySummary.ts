import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type MarketingYearlySummaryRow = {
  year: number;
  totalAttempts: number;
  totalMeetingsSet: number;
  totalClientsClosed: number;
  totalRevenueCents: number;
  attemptsToMeetingsPct: number;
  meetingsToClientsPct: number;
};

type RawRow = {
  user_id: string;
  company_id: string;
  year: number;
  total_attempts: bigint;
  total_meetings_set: bigint;
  total_clients_closed: bigint;
  total_revenue_cents: bigint;
  attempts_to_meetings_pct: string | number;
  meetings_to_clients_pct: string | number;
};

export async function getMarketingYearlySummary(
  userId: string,
  year?: number
): Promise<MarketingYearlySummaryRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>(
    year !== undefined
      ? Prisma.sql`SELECT * FROM marketing_yearly_summary WHERE user_id = ${userId}::uuid AND year = ${year}`
      : Prisma.sql`SELECT * FROM marketing_yearly_summary WHERE user_id = ${userId}::uuid ORDER BY year DESC`
  );

  return rows.map((r) => ({
    year: Number(r.year),
    totalAttempts: Number(r.total_attempts),
    totalMeetingsSet: Number(r.total_meetings_set),
    totalClientsClosed: Number(r.total_clients_closed),
    totalRevenueCents: Number(r.total_revenue_cents),
    attemptsToMeetingsPct: Number(r.attempts_to_meetings_pct),
    meetingsToClientsPct: Number(r.meetings_to_clients_pct),
  }));
}
