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

    // Parse the timestamp from the first line
    const lines = fileContent.split('\n');
    let timestamp = null;
    let content = fileContent;

    if (lines[0].startsWith('Analysis Timestamp: ')) {
      timestamp = lines[0].replace('Analysis Timestamp: ', '');
      // Remove the timestamp line and the next line (website URL) to get just the analysis content
      content = lines.slice(2).join('\n');
    }

    res.status(200).json({
      hasContent: true,
      content: content,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('Error loading analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
