import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
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

    const { email, name, role = 'user' } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({ error: 'Email, name, and role are required' });
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "user"' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate a random password
    const password = crypto.randomBytes(8).toString('hex');
    
    // Encrypt the password
    const encryptedPassword = encrypt(password);

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordEnc: encryptedPassword
      }
    });

    res.status(200).json({ 
      success: true, 
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      password // Return the generated password
    });

  } catch (error) {
    console.error('Error creating admin account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
