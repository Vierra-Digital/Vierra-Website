import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, generateCaption } from '@/lib/contentGeneration';
import { requireSession } from '@/lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require authentication
    const session = await requireSession(req, res);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { platform, contentType, includeContext, imageUrls } = req.body;

    console.log('API received includeContext:', includeContext);
    console.log('API received imageUrls:', imageUrls ? `${imageUrls.length} images` : 'not provided');

    if (!platform || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: platform, contentType' 
      });
    }

    if (!['image', 'caption'].includes(contentType)) {
      return res.status(400).json({ error: 'contentType must be either "image" or "caption"' });
    }

    const userId = Number(session.user.id);

    let result;
    if (contentType === 'image') {
      result = await generateImage(platform, includeContext, imageUrls, userId);
    } else {
      result = await generateCaption(platform, includeContext, imageUrls, userId);
    }

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
