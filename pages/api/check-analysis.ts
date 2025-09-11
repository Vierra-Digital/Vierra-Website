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

    // Check if user has any website analysis
    const analysis = await prisma.websiteAnalysis.findFirst({
      where: { userId },
      select: { id: true }
    });

    const hasAnalysis = !!analysis;

    res.status(200).json({ 
      success: true, 
      hasAnalysis 
    });

  } catch (error) {
    console.error('Error checking analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
