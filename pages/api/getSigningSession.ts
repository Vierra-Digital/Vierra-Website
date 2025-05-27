import { NextApiRequest, NextApiResponse } from 'next';
import { getSessionData } from '@/lib/sessionStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        // Extract token from query parameters
        const { tokenId } = req.query;
        
        if (!tokenId || typeof tokenId !== 'string') {
            return res.status(400).json({ message: 'Missing required tokenId parameter' });
        }

        // Get session data for the token
        const sessionData = getSessionData(tokenId);
        
        if (!sessionData) {
            return res.status(404).json({ message: 'Session not found or expired' });
        }

        // Return only necessary data to the client
        const responseData = {
            coordinates: sessionData.coordinates,
            originalFilename: sessionData.originalFilename,
            status: sessionData.status,
            pdfBase64: sessionData.pdfBase64
        };

        return res.status(200).json(responseData);
    } catch (error: unknown) {
        console.error('[get-signing-session] Uncaught exception:', error);
        const message = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ message: `An unexpected error occurred: ${message}` });
    }
}