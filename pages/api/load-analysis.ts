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

    const userId = Number(session.user.id);

    // Get the most recent website analysis for this user
    const analysis = await prisma.websiteAnalysis.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' }
    });

    if (analysis) {
      res.status(200).json({ 
        success: true, 
        analysis: analysis.analysis,
        timestamp: analysis.timestamp,
        websiteUrl: analysis.websiteUrl
      });
    } else {
      res.status(200).json({ 
        success: true, 
        analysis: null,
        timestamp: null,
        websiteUrl: null
      });
    }

  } catch (error) {
    console.error('Error loading analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
