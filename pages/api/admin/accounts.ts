import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
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

    // Fetch all accounts
    const allAccounts = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true
      },
      orderBy: {
        id: 'desc'
      }
    });

    res.status(200).json({ 
      success: true, 
      accounts: allAccounts 
    });

  } catch (error) {
    console.error('Error fetching admin accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
