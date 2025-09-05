import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { client: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a temporary impersonation token
    const impersonationToken = crypto.randomBytes(32).toString('hex');
    
    // Store impersonation data (in a real app, you'd store this in Redis or database)
    const impersonationData = {
      token: impersonationToken,
      originalAdminId: session.user.id,
      originalAdminEmail: session.user.email,
      originalAdminRole: (session.user as any).role,
      impersonatedUserId: targetUser.id,
      impersonatedUserEmail: targetUser.email,
      impersonatedUserRole: targetUser.role,
      impersonatedUserName: targetUser.client?.name || 'Unknown',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // For now, we'll return the token and the impersonation details so the client
    // can persist them in localStorage (a lightweight demo approach)
    res.status(200).json({
      success: true,
      impersonationToken,
      redirectUrl: `/client?impersonate=${impersonationToken}`,
      impersonationData: {
        originalAdminId: session.user.id,
        originalAdminEmail: session.user.email,
        originalAdminRole: (session.user as any).role,
        impersonatedUserId: targetUser.id,
        impersonatedUserEmail: targetUser.email,
        impersonatedUserRole: targetUser.role,
        impersonatedUserName: targetUser.client?.name || targetUser.email || 'User'
      },
      message: 'Impersonation successful'
    });

  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
