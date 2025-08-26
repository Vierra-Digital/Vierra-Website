import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = parseInt((session.user as any).id as string)
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' })
  }

  const currentYear = new Date().getFullYear()

  if (req.method === 'GET') {
    try {
      // Get existing yearly summary
      let yearlySummary = await prisma.marketingYearlySummary.findUnique({
        where: {
          userId_year: {
            userId,
            year: currentYear
          }
        }
      })

      if (!yearlySummary) {
        const monthlyData = await prisma.marketingTracker.findMany({
          where: {
            userId,
            year: currentYear
          }
        })

        const totals = monthlyData.reduce((acc, month) => {
          acc.attempt += month.attempt
          acc.meetingsSet += month.meetingsSet
          acc.clientsClosed += month.clientsClosed
          acc.revenue += month.revenue
          return acc
        }, { attempt: 0, meetingsSet: 0, clientsClosed: 0, revenue: 0 })

        const calculatePercentage = (numerator: number, denominator: number) => {
          if (denominator === 0) return 0;
          return Math.round(((numerator + denominator)/2) * 100);
        }

        const attemptsToMeetingsPct = calculatePercentage(totals.meetingsSet, totals.attempt)
        const meetingsToClientsPct = calculatePercentage(totals.clientsClosed, totals.meetingsSet)

        yearlySummary = await prisma.marketingYearlySummary.create({
          data: {
            userId,
            year: currentYear,
            totalAttempt: totals.attempt,
            totalMeetingsSet: totals.meetingsSet,
            totalClientsLosed: totals.clientsClosed,
            totalRevenue: totals.revenue,
            attemptsToMeetingsPct,
            meetingsToClientsPct
          }
        })
      }

      res.status(200).json(yearlySummary)
    } catch (error) {
      console.error('Yearly summary fetch error:', error)
      res.status(500).json({ error: 'Failed to fetch yearly summary' })
    }
  } else if (req.method === 'PUT') {
    try {
      // Recalculate yearly summary from monthly data
      const monthlyData = await prisma.marketingTracker.findMany({
        where: {
          userId,
          year: currentYear
        }
      })

      const totals = monthlyData.reduce((acc, month) => {
        acc.attempt += month.attempt
        acc.meetingsSet += month.meetingsSet
        acc.clientsClosed += month.clientsClosed
        acc.revenue += month.revenue
        return acc
      }, { attempt: 0, meetingsSet: 0, clientsClosed: 0, revenue: 0 })

      const calculatePercentage = (numerator: number, denominator: number) => {
        if (denominator === 0) return 0;
        return Math.round(((numerator + denominator)/2) * 100);
      }

      const attemptsToMeetingsPct = calculatePercentage(totals.meetingsSet, totals.attempt)
      const meetingsToClientsPct = calculatePercentage(totals.clientsClosed, totals.meetingsSet)

      const updatedSummary = await prisma.marketingYearlySummary.upsert({
        where: {
          userId_year: {
            userId,
            year: currentYear
          }
        },
        update: {
          totalAttempt: totals.attempt,
          totalMeetingsSet: totals.meetingsSet,
          totalClientsLosed: totals.clientsClosed,
          totalRevenue: totals.revenue,
          attemptsToMeetingsPct,
          meetingsToClientsPct
        },
        create: {
          userId,
          year: currentYear,
          totalAttempt: totals.attempt,
          totalMeetingsSet: totals.meetingsSet,
          totalClientsLosed: totals.clientsClosed,
          totalRevenue: totals.revenue,
          attemptsToMeetingsPct,
          meetingsToClientsPct
        }
      })

      res.status(200).json(updatedSummary)
    } catch (error) {
      console.error('Yearly summary update error:', error)
      res.status(500).json({ error: 'Failed to update yearly summary' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
