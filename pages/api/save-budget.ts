import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { budget, userId } = req.body

    if (!budget || typeof budget !== 'number' || budget <= 0) {
      return res.status(400).json({ error: 'Invalid budget amount' })
    }

    // Save budget in ClientContext table as additional context for now
    // This is a temporary solution until we create a campaigns table
    const budgetContext = `Campaign Budget: $${budget}`;
    
    // Check if user has existing context
    const existingContext = await prisma.clientContext.findUnique({
      where: { userId: parseInt(userId) }
    });

    if (existingContext) {
      // Update existing context to include budget
      let updatedContext = existingContext.context;
      
      // Remove any existing budget line and add new one
      const lines = updatedContext.split('\n').filter(line => !line.startsWith('Campaign Budget:'));
      lines.push(budgetContext);
      updatedContext = lines.join('\n');
      
      await prisma.clientContext.update({
        where: { userId: parseInt(userId) },
        data: { 
          context: updatedContext,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new context with budget
      await prisma.clientContext.create({
        data: {
          userId: parseInt(userId),
          context: budgetContext,
          isActive: true
        }
      });
    }

    console.log(`Budget saved for user ${userId}: $${budget}`)

    return res.status(200).json({ 
      success: true, 
      message: 'Budget saved successfully',
      budget: budget 
    })

  } catch (error) {
    console.error('Error saving budget:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
