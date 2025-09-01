import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeWebsite } from '@/lib/websiteAnalysis';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { websiteUrl } = req.body;

    if (!websiteUrl) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    // Normalize URL - add https:// if no protocol is specified
    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate URL format
    try {
      new URL(normalizedUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const result = await analyzeWebsite(normalizedUrl);

    if (result.success) {
      // Extract timestamp from the file content
      const filePath = path.join(process.cwd(), 'public', 'analysis-results', 'website-analysis-latest.txt');
      let timestamp = null;
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        if (lines[0].startsWith('Analysis Timestamp: ')) {
          timestamp = lines[0].replace('Analysis Timestamp: ', '');
        }
      }
      
      res.status(200).json({
        ...result,
        timestamp: timestamp
      });
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
