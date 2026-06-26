import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireRole(req, res);
  if (!session) return;
  const { companyId } = session;

  const { clientName, clientEmail, businessName, industry, monthlyRetainer, clientGoal } = req.body ?? {};
  if (!clientName || !clientEmail || !businessName) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  const monthlyRetainerAmount = Number(monthlyRetainer);
  if (!Number.isFinite(monthlyRetainerAmount) || monthlyRetainerAmount <= 0) {
    return res.status(400).json({ message: "Monthly retainer must be greater than 0." });
  }
  const monthlyRetainerCents = Math.round(monthlyRetainerAmount * 100);
  const clientGoalAmount = Number(clientGoal);
  if (!Number.isInteger(clientGoalAmount) || clientGoalAmount < 0) {
    return res.status(400).json({ message: "Client goal must be a whole number (0 or higher)." });
  }

  try {
    const email = String(clientEmail).toLowerCase();
    const token = crypto.randomUUID();

    let client = await prisma.client.findFirst({ where: { company_id: companyId, email } });
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: { name: clientName, business_name: businessName, client_goal: clientGoalAmount },
      });
    } else {
      client = await prisma.client.create({
        data: {
          company_id: companyId,
          name: clientName,
          email,
          business_name: businessName,
          client_goal: clientGoalAmount,
        },
      });
    }
    await prisma.clientBilling.upsert({
      where: { client_id: client.id },
      create: { client_id: client.id, monthly_retainer_cents: monthlyRetainerCents },
      update: { monthly_retainer_cents: monthlyRetainerCents },
    });

    const onboardingSession = await prisma.onboardingSession.create({
      data: {
        id: token,
        client_id: client.id,
        company_id: companyId,
        status: "pending",
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        answers: { industry },
      },
      select: { id: true, created_at: true, submitted_at: true, status: true, answers: true },
    });

    return res.status(200).json({
      link: `/onboarding/${token}`,
      token,
      summary: {
        token: onboardingSession.id,
        clientName: client.name,
        clientEmail: client.email,
        businessName: client.business_name,
        monthlyRetainer: monthlyRetainerCents / 100,
        clientGoal: client.client_goal ?? null,
        createdAt: new Date(onboardingSession.created_at).getTime(),
        submittedAt: onboardingSession.submitted_at
          ? new Date(onboardingSession.submitted_at).getTime()
          : null,
        status: onboardingSession.status ?? "pending",
        hasAnswers: !!onboardingSession.answers,
      },
    });
  } catch (err) {
    console.error("Create session failed:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
