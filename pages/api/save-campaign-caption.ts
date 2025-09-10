import { NextApiRequest, NextApiResponse } from 'next'
import { requireSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await requireSession(req, res)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { campaignId, platform, caption, userId } = req.body

    if (!campaignId || !platform) {
      return res.status(400).json({ error: 'Campaign ID and platform are required' })
    }

    // Verify the campaign belongs to the user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: parseInt(userId)
      }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    // Upsert the caption (create if doesn't exist, update if it does)
    const savedCaption = await prisma.campaignCaption.upsert({
      where: {
        campaignId_platform: {
          campaignId: campaignId,
          platform: platform
        }
      },
      update: {
        caption: caption || '',
        updatedAt: new Date()
      },
      create: {
        campaignId: campaignId,
        platform: platform,
        caption: caption || ''
      }
    })

    return res.status(200).json({ 
      success: true, 
      message: 'Caption saved successfully',
      caption: savedCaption
    })

  } catch (error) {
    console.error('Error saving campaign caption:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
