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
    const filePath = path.join(process.cwd(), 'public', 'analysis-results', 'additional-context-latest.txt');
    
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ hasContent: false });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (!fileContent.trim()) {
      return res.status(200).json({ hasContent: false });
    }

    // Parse the content from the file (remove timestamp line and instruction)
    const lines = fileContent.split('\n');
    let content = fileContent;

    if (lines[0].startsWith('Additional Context Timestamp: ')) {
      // Remove the timestamp line and instruction to get just the user context content
      content = lines.slice(4).join('\n');
    }

    res.status(200).json({
      hasContent: true,
      content: content
    });

  } catch (error) {
    console.error('Error loading additional context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
