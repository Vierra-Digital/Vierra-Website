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

    const { campaignId, userId } = req.body

    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID is required' })
    }

    // Verify the campaign belongs to the user before deleting
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: parseInt(userId)
      }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or you do not have permission to delete it' })
    }

    // Delete the campaign (this will also cascade delete related captions due to the relation)
    await prisma.campaign.delete({
      where: {
        id: campaignId
      }
    })

    return res.status(200).json({ 
      success: true, 
      message: 'Campaign deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting campaign:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
