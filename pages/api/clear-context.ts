import type { NextApiRequest, NextApiResponse } from 'next';
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

    const userId = Number(session.user.id);

    // Set all contexts for this user to inactive
    await prisma.clientContext.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    console.log('Context cleared for user:', userId);

    res.status(200).json({ 
      success: true, 
      message: 'Context cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
