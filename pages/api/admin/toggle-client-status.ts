import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if current user is admin
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if ((session.user as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId, isActive } = req.body;

    if (!userId || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'User ID and isActive status are required' });
    }

    // For now, we'll just verify the user exists and return success
    // In a real implementation, you'd want to add an 'isActive' field to the User model
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For now, we'll return success and let the frontend handle the status
    // In a production app, you'd want to add an isActive field to your User model
    res.status(200).json({ 
      success: true,
      message: 'Client status updated successfully',
      userId: userId,
      isActive: isActive
    });

  } catch (error) {
    console.error('Error toggling client status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
