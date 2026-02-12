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

        // Return fields for new format, or construct from coordinates for legacy
        const firstSignature = sessionData.fields?.find(f => f.type === 'signature');
        const coords = sessionData.coordinates ?? (firstSignature ? {
            page: firstSignature.page,
            xRatio: firstSignature.xRatio,
            yRatio: firstSignature.yRatio,
            width: firstSignature.width,
            height: firstSignature.height,
        } : undefined);
        const fields = sessionData.fields ?? (coords ? [{
            type: 'signature' as const,
            page: coords.page,
            xRatio: coords.xRatio,
            yRatio: coords.yRatio,
            width: coords.width,
            height: coords.height,
            id: 'legacy',
        }] : undefined);
        const responseData = {
            coordinates: coords,
            fields,
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