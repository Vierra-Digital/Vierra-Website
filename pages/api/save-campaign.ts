import { NextApiRequest, NextApiResponse } from 'next'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await requireSession(req, res)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { campaignName, budget, platforms, userId, generatedContent } = req.body

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

      // Save generated content for updated campaign
      if (generatedContent && existingCampaign) {
        await saveGeneratedContent(req, existingCampaign.id, generatedContent)
      }

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

      // Save generated content for new campaign
      if (generatedContent) {
        await saveGeneratedContent(req, newCampaign.id, generatedContent)
      }

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

// Helper: normalize potential URL/dataURI/base64 to raw base64 string
async function normalizeToBase64(req: NextApiRequest, value?: string): Promise<string> {
  if (!value) return ''
  // If already raw base64 (no comma, typical characters), return as is
  if (!value.startsWith('http') && !value.startsWith('/api/') && !value.startsWith('data:')) {
    return value
  }
  // If data URI, strip prefix
  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',')
    return commaIndex !== -1 ? value.slice(commaIndex + 1) : value
  }
  // If it's an API/local URL, fetch it from the server side to avoid CORS and convert to base64
  try {
    const origin = req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host']}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const absoluteUrl = value.startsWith('http') ? value : `${origin}${value}`
    const resp = await fetch(absoluteUrl)
    const arrayBuffer = await resp.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return base64
  } catch (e) {
    console.error('Failed to fetch/convert image to base64:', e)
    return ''
  }
}

// Helper function to save generated content
async function saveGeneratedContent(req: NextApiRequest, campaignId: string, generatedContent: any) {
  if (!generatedContent) return

  for (const platform of Object.keys(generatedContent)) {
    const content = generatedContent[platform]
    if (content && (content.image || content.caption)) {
      // Normalize image to raw base64 for database storage
      const normalizedBase64 = await normalizeToBase64(req, content.image)
      await prisma.campaignCaption.upsert({
        where: {
          campaignId_platform: {
            campaignId: campaignId,
            platform: platform
          }
        },
        update: {
          caption: content.caption || '',
          imageData: normalizedBase64 || '',
          updatedAt: new Date()
        },
        create: {
          campaignId: campaignId,
          platform: platform,
          caption: content.caption || '',
          imageData: normalizedBase64 || ''
        }
      })
    }
  }
}

// Increase body size limit to allow base64 image payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
}
