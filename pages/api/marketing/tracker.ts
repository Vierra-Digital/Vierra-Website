import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const userId = Number((session.user as any).id);

  if (req.method === "GET") {
    
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) {
      res.status(400).json({ message: "Missing year or month" });
      return;
    }
    try {
      const trackerData = await prisma.marketingTracker.findMany({
        where: { userId, year, month },
        select: {
          outreach: true,
          attempt: true,
          meetingsSet: true,
          clientsClosed: true,
          revenue: true,
          attemptsToMeetingsPct: true,
          meetingsToClientsPct: true,
        },
      });
      res.status(200).json({ trackerData });
    } catch (e) {
      console.error("Error fetching marketing tracker:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const { year, month, trackerData } = req.body;
  if (!year || !month || !Array.isArray(trackerData)) {
    res.status(400).json({ message: "Missing required fields" });
    return;
  }

  try {
    for (const tracker of trackerData) {
      const {
        outreach,
        attempt,
        meetingsSet,
        clientsClosed,
        revenue,
        attemptsToMeetingsPct,
        meetingsToClientsPct,
      } = tracker;

      await prisma.marketingTracker.upsert({
        where: {
          userId_year_month_outreach: {
            userId,
            year,
            month,
            outreach,
          },
        },
        update: {
          attempt,
          meetingsSet,
          clientsClosed,
          revenue,
          attemptsToMeetingsPct,
          meetingsToClientsPct,
          updatedAt: new Date(),
        },
        create: {
          id: uuidv4(),
          userId,
          year,
          month,
          outreach,
          attempt,
          meetingsSet,
          clientsClosed,
          revenue,
          attemptsToMeetingsPct,
          meetingsToClientsPct,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
    res.status(200).json({ success: true });
  } catch (e) {
    console.error("Error updating marketing tracker:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
