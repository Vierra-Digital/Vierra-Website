import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeWebsite } from '@/lib/websiteAnalysis';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const { websiteUrl } = req.body;
    if (!websiteUrl) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    // Normalize URL - add https:// if no protocol is specified
    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate URL format
    try {
      new URL(normalizedUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Session user ID:', session.user.id);
    console.log('Session user:', session.user);
    
    // Check if user exists, create if not
    const userId = Number(session.user.id);
    let user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      console.log('User not found, creating user with ID:', userId);
      user = await prisma.user.create({
        data: {
          id: userId,
          email: session.user.email || `user${userId}@example.com`,
          role: session.user.role || 'user'
        }
      });
      console.log('Created user:', user);
    }
    
    const result = await analyzeWebsite(normalizedUrl, userId);

    if (result.success) {
      res.status(200).json({
        ...result,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
