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

    const { campaignName, budget, platforms, userId } = req.body

    if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
      return res.status(400).json({ error: 'Invalid campaign name' })
    }

    // Check if user already has a campaign with this name
    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        userId: parseInt(userId),
        name: campaignName.trim()
      }
    })

    if (existingCampaign) {
      // Update existing campaign
      const updatedCampaign = await prisma.campaign.update({
        where: { id: existingCampaign.id },
        data: {
          budget: budget || 0,
          platforms: platforms || [],
          updatedAt: new Date()
        }
      })

      return res.status(200).json({ 
        success: true, 
        message: 'Campaign updated successfully',
        campaign: updatedCampaign
      })
    } else {
      // Create new campaign
      const newCampaign = await prisma.campaign.create({
        data: {
          userId: parseInt(userId),
          name: campaignName.trim(),
          budget: budget || 0,
          platforms: platforms || [],
          status: 'draft'
        }
      })

      return res.status(200).json({ 
        success: true, 
        message: 'Campaign created successfully',
        campaign: newCampaign
      })
    }

  } catch (error) {
    console.error('Error saving campaign:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
