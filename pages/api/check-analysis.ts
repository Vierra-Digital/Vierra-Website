import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'analysis-results', 'website-analysis-latest.txt');
    
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ hasContent: false });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (!fileContent.trim()) {
      return res.status(200).json({ hasContent: false });
    }

    // Check if the file starts with "Analysis Timestamp"
    const hasContent = fileContent.trim().startsWith('Analysis Timestamp:');

    res.status(200).json({
      hasContent: hasContent
    });

  } catch (error) {
    console.error('Error checking analysis file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
