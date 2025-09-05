import type { NextApiRequest, NextApiResponse } from 'next';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await requireSession(req, res);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = Number(session.user.id);

    // Fetch all generated images for the user
    const images = await prisma.generatedContent.findMany({
      where: {
        userId,
        contentType: 'image'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        platform: true,
        content: true,
        urlLink: true,
        metadata: true,
        createdAt: true
      }
    });

    // Group images by platform
    const imagesByPlatform = images.reduce((acc, image) => {
      if (!acc[image.platform]) {
        acc[image.platform] = [];
      }
      acc[image.platform].push({
        id: image.id,
        platform: image.platform,
        content: image.content, // base64 image data
        urlLink: image.urlLink,
        metadata: image.metadata,
        createdAt: image.createdAt
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.status(200).json({
      success: true,
      images: imagesByPlatform,
      totalImages: images.length
    });

  } catch (error) {
    console.error('Error fetching gallery images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
