import { NextApiRequest, NextApiResponse } from 'next'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await requireSession(req, res)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    // requireSession already applies impersonation via cookie/header
    const effectiveUserId = parseInt(session.user.id as string)

    // Fetch user's campaigns from database with captions
    const campaigns = await prisma.campaign.findMany({
      where: { userId: effectiveUserId },
      include: {
        captions: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform campaigns to create platform-specific entries
    const platformCampaigns: any[] = []

    campaigns.forEach(campaign => {
      campaign.platforms.forEach(platform => {
        // Find the caption/image for this platform
        const caption = campaign.captions.find(c => c.platform === platform)
        
        platformCampaigns.push({
          id: `${campaign.id}-${platform}`,
          campaignId: campaign.id,
          name: `${campaign.name} - ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
          platform: platform,
          status: campaign.status,
          budget: campaign.budget,
          spent: campaign.spent,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          createdAt: campaign.createdAt,
          originalCampaignName: campaign.name,
          caption: caption?.caption || '',
          imageData: caption?.imageData || ''
        })
      })
    })

    return res.status(200).json({ 
      success: true, 
      campaigns: platformCampaigns
    })

  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
