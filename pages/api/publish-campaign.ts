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

    const { campaignName, userId } = req.body

    if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
      return res.status(400).json({ error: 'Invalid campaign name' })
    }

    // Find the campaign to publish
    const campaign = await prisma.campaign.findFirst({
      where: {
        userId: parseInt(userId),
        name: campaignName.trim()
      }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Update campaign to active status with start date
    const publishedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'active',
        startDate: new Date(),
        updatedAt: new Date()
      }
    })

    return res.status(200).json({ 
      success: true, 
      message: 'Campaign published successfully',
      campaign: publishedCampaign
    })

  } catch (error) {
    console.error('Error publishing campaign:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
