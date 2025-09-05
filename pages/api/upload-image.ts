import type { NextApiRequest, NextApiResponse } from 'next';

// Configure the API route to handle larger request bodies
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Increase body size limit to 50MB
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { b64, ext } = req.body;

    if (!b64 || !ext) {
      return res.status(400).json({ 
        error: 'Missing required fields: b64, ext' 
      });
    }

    // Log the size of the base64 data for debugging
    const base64SizeInMB = (b64.length * 0.75) / (1024 * 1024); // Approximate size calculation
    console.log(`Uploading image: ${base64SizeInMB.toFixed(2)} MB`);

    // Forward the request to the URL generator service
    const response = await fetch('https://urlgenerator-production.up.railway.app/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Ronni1939'
      },
      body: JSON.stringify({ b64, ext })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Image uploaded to URL generator via proxy:', {
        id: result.id,
        url: result.url,
        expires_in_seconds: result.expires_in_seconds
      });
      
      res.status(200).json(result);
    } else {
      console.error('URL generator service error:', response.status, response.statusText);
      res.status(response.status).json({ 
        error: `URL generator service error: ${response.status}` 
      });
    }

  } catch (error) {
    console.error('Proxy API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
