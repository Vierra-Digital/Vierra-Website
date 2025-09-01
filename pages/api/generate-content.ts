import type { NextApiRequest, NextApiResponse } from 'next';
import { generateImage, generateCaption } from '@/lib/contentGeneration';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { platform, contentType, includeContext } = req.body;

    console.log('API received includeContext:', includeContext);

    if (!platform || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: platform, contentType' 
      });
    }

    if (!['image', 'caption'].includes(contentType)) {
      return res.status(400).json({ error: 'contentType must be either "image" or "caption"' });
    }

    let result;
    if (contentType === 'image') {
      result = await generateImage(platform, includeContext);
    } else {
      result = await generateCaption(platform, includeContext);
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
