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

    // Allow access if user is admin OR if they're impersonating (check for impersonation header)
    const isAdmin = (session.user as any).role === 'admin';
    const isImpersonating = req.headers['x-impersonation'] === 'true';
    
    if (!isAdmin && !isImpersonating) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Verify the target account exists (any role, not just admin)
    const targetAccount = await prisma.user.findUnique({
      where: { 
        id: parseInt(accountId)
      }
    });

    if (!targetAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // For now, we'll return success and let the client handle the redirect
    // In a real implementation, you would update the session here
    res.status(200).json({ 
      success: true,
      message: 'Account switch initiated',
      targetAccount: {
        id: targetAccount.id,
        email: targetAccount.email,
        name: targetAccount.name,
        role: targetAccount.role
      }
    });

  } catch (error) {
    console.error('Error switching account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
