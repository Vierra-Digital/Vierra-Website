import type { NextApiRequest, NextApiResponse } from 'next';
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
    const { additionalContext } = req.body;

    if (additionalContext === undefined) {
      return res.status(400).json({ error: 'Additional context is required' });
    }

    // Save additional context to file
    const filePath = path.join(process.cwd(), 'public', 'analysis-results', 'additional-context-latest.txt');
    
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save to file (overwrites previous content)
    const timestamp = new Date().toISOString();
    const instruction = "This is context added by the user they have specifically asked to be included in this ad make sure to include everything that is asked for and follow it as closely as you can if no context is included just base the ad on the website analasys as usual";
    const fileContent = `\n${instruction}\n\n${additionalContext}`;
    fs.writeFileSync(filePath, fileContent);
    
    console.log('Additional context saved successfully');
    console.log('File path:', filePath);

    res.status(200).json({ 
      success: true, 
      message: 'Additional context saved successfully' 
    });

  } catch (error) {
    console.error('Error saving additional context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
