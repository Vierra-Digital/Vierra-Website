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

    const { additionalContext } = req.body;
    if (additionalContext === undefined) {
      return res.status(400).json({ error: 'Additional context is required' });
    }

    const userId = Number(session.user.id);

    // Save or update context in database
    const instruction = "This is context added by the user they have specifically asked to be included in this ad make sure to include everything that is asked for and follow it as closely as you can if no context is included just base the ad on the website analasys as usual";
    const fullContext = `${instruction}\n\n${additionalContext}`;

    // Find existing context or create new one
    let context = await prisma.clientContext.findFirst({
      where: { userId }
    });

    if (context) {
      // Update existing context
      context = await prisma.clientContext.update({
        where: { id: context.id },
        data: {
          context: fullContext,
          isActive: true,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new context
      context = await prisma.clientContext.create({
        data: {
          userId,
          context: fullContext,
          isActive: true
        }
      });
    }

    console.log('Additional context saved to database successfully');
    console.log('Context ID:', context.id);

    res.status(200).json({ 
      success: true, 
      message: 'Additional context saved successfully',
      contextId: context.id
    });

  } catch (error) {
    console.error('Error saving additional context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
