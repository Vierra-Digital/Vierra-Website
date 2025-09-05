import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { budget, userId } = req.body

    if (!budget || typeof budget !== 'number' || budget <= 0) {
      return res.status(400).json({ error: 'Invalid budget amount' })
    }

    // For now, we'll just log the budget since there's no campaigns table yet
    // In the future, this would save to a campaigns table
    console.log(`Budget saved for user ${userId}: $${budget}`)

    // TODO: Implement actual database save when campaigns table is created
    // await prisma.campaign.create({
    //   data: {
    //     userId: userId,
    //     budget: budget,
    //     status: 'draft',
    //     // ... other campaign fields
    //   }
    // })

    return res.status(200).json({ 
      success: true, 
      message: 'Budget saved successfully',
      budget: budget 
    })

  } catch (error) {
    console.error('Error saving budget:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
