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
    // Require authentication
    const session = await requireSession(req, res);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Content ID is required' });
    }

    const userId = Number(session.user.id);

    // Get the content from database
    const content = await prisma.generatedContent.findFirst({
      where: { 
        id,
        userId,
        contentType: 'image'
      }
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Convert base64 to buffer and serve as image
    const imageBuffer = Buffer.from(content.content, 'base64');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error serving content image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
