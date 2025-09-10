import { NextApiRequest, NextApiResponse } from 'next'
import { requireSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await requireSession(req, res)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { campaignId, platform } = req.query

    if (!campaignId || !platform) {
      return res.status(400).json({ error: 'Campaign ID and platform are required' })
    }

    // Find the caption for this campaign and platform
    const captionRecord = await prisma.campaignCaption.findUnique({
      where: {
        campaignId_platform: {
          campaignId: campaignId as string,
          platform: platform as string
        }
      }
    })

    return res.status(200).json({ 
      success: true, 
      caption: captionRecord?.caption || ''
    })

  } catch (error) {
    console.error('Error fetching campaign caption:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
