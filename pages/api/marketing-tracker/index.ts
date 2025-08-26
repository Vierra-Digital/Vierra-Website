import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Convert userId to number since it might come as string from session
  const userId = parseInt((session.user as any).id as string)
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' })
  }

  const currentYear = new Date().getFullYear()

  if (req.method === 'GET') {
    try {
      const data = await prisma.marketingTracker.findMany({
        where: {
          userId,
          year: currentYear
        },
        orderBy: { month: 'asc' }
      })

      // Fill in missing months with default values
      const allMonthsData = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const existing = data.find(d => d.month === month)
        return existing || {
          month,
          attempt: 0,
          meetingsSet: 0,
          clientsClosed: 0,
          revenue: 0,
          attemptsToMeetingsPct: 0,
          meetingsToClientsPct: 0
        }
      })

      res.status(200).json(allMonthsData)
    } catch (error) {
      console.error('Marketing tracker fetch error:', error)
      res.status(500).json({ error: 'Failed to fetch data' })
    }
  } else if (req.method === 'PUT') {
    try {
      const { month, field, value } = req.body
      const currentMonth = new Date().getMonth() + 1
      
      // Only allow editing current month
      if (month !== currentMonth) {
        return res.status(403).json({ error: 'Can only edit current month data' })
      }

      const validFields = ['attempt', 'meetingsSet', 'clientsClosed', 'revenue']
      if (!validFields.includes(field)) {
        return res.status(400).json({ error: 'Invalid field' })
      }

      // Get current data to calculate percentages
      const currentData = await prisma.marketingTracker.findUnique({
        where: {
          userId_year_month: {
            userId,
            year: currentYear,
            month
          }
        }
      })

      // Prepare the updated values
      const updatedValues = {
        attempt: currentData?.attempt || 0,
        meetingsSet: currentData?.meetingsSet || 0,
        clientsClosed: currentData?.clientsClosed || 0,
        revenue: currentData?.revenue || 0,
        [field]: field === 'revenue' ? parseFloat(value) : parseInt(value)
      }

      // Calculate percentages
      const attemptsToMeetingsPct = updatedValues.attempt > 0 
        ? Math.round(((updatedValues.meetingsSet + updatedValues.attempt)/2) * 100)
        : 0

      const meetingsToClientsPct = updatedValues.meetingsSet > 0
        ? Math.round(((updatedValues.clientsClosed + updatedValues.meetingsSet)/2) * 100)
        : 0

      const updatedData = await prisma.marketingTracker.upsert({
        where: {
          userId_year_month: {
            userId,
            year: currentYear,
            month
          }
        },
        update: {
          [field]: field === 'revenue' ? parseFloat(value) : parseInt(value),
          attemptsToMeetingsPct,
          meetingsToClientsPct
        },
        create: {
          userId,
          year: currentYear,
          month,
          [field]: field === 'revenue' ? parseFloat(value) : parseInt(value),
          attemptsToMeetingsPct,
          meetingsToClientsPct
        }
      })

      // Update yearly summary directly after monthly data change
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

      // Use your percentage calculation method
      const calculatePercentage = (numerator: number, denominator: number) => {
        if (denominator === 0) return 0;
        return Math.round(((numerator + denominator)/2) * 100);
      }

      const yearlyAttemptsToMeetingsPct = calculatePercentage(totals.meetingsSet, totals.attempt)
      const yearlyMeetingsToClientsPct = calculatePercentage(totals.clientsClosed, totals.meetingsSet)

      await prisma.marketingYearlySummary.upsert({
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
          attemptsToMeetingsPct: yearlyAttemptsToMeetingsPct,
          meetingsToClientsPct: yearlyMeetingsToClientsPct
        },
        create: {
          userId,
          year: currentYear,
          totalAttempt: totals.attempt,
          totalMeetingsSet: totals.meetingsSet,
          totalClientsLosed: totals.clientsClosed,
          totalRevenue: totals.revenue,
          attemptsToMeetingsPct: yearlyAttemptsToMeetingsPct,
          meetingsToClientsPct: yearlyMeetingsToClientsPct
        }
      })

      res.status(200).json(updatedData)
    } catch (error) {
      console.error('Marketing tracker update error:', error)
      res.status(500).json({ error: 'Failed to update data' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
}
}
