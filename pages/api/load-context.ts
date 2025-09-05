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

    // Get the most recent active context for this user
    const context = await prisma.clientContext.findFirst({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (context) {
      // Extract just the user's context (remove the instruction)
      const lines = context.context.split('\n');
      const userContext = lines.slice(2).join('\n').trim();
      
      res.status(200).json({ 
        success: true, 
        context: userContext,
        isActive: context.isActive
      });
    } else {
      res.status(200).json({ 
        success: true, 
        context: '',
        isActive: false
      });
    }

  } catch (error) {
    console.error('Error loading context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
