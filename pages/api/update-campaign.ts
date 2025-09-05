import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { campaignId, status, budget, caption, userId } = req.body

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' })
    }

    // Build update data object
    const updateData: any = { updatedAt: new Date() }
    
    if (status !== undefined) updateData.status = status
    if (budget !== undefined) updateData.budget = Number(budget)
    // Note: We'll need to add caption field to the Campaign model later
    // if (caption !== undefined) updateData.caption = caption

    // Update the campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { 
        id: campaignId,
        userId: parseInt(userId)
      },
      data: updateData
    })

    return res.status(200).json({ 
      success: true, 
      message: 'Campaign updated successfully',
      campaign: updatedCampaign
    })

  } catch (error) {
    console.error('Error updating campaign:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
