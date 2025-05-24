import fs from 'fs';
import path from 'path';

export interface SessionData {
    token: string;
    originalFilename: string;
    pdfPath: string;
    pdfBase64?: string,
    coordinates: {
        page: number;
        xRatio: number;
        yRatio: number;
        width: number;
        height: number;
    };
    status: 'pending' | 'signed' | 'expired';
    createdAt: number;
    signedPdfPath?: string;
    signerEmail?: string;
}

// In-memory session storage that works in all environments including Netlify
const SESSION_STORE = new Map<string, SessionData>();

// Location for filesystem-based session storage (used in local development)
const sessionsDir = path.resolve(process.cwd(), 'public', 'signing_sessions');

// Try to create the sessions directory but don't crash if it fails
try {
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
} catch (error) {
    console.warn('Failed to create sessions directory (normal in serverless):', error);
}

export function getSessionData(tokenId: string): SessionData | null {
    // First check in-memory storage - works in all environments
    if (SESSION_STORE.has(tokenId)) {
        return SESSION_STORE.get(tokenId)!;
    }
    
    // Fallback to filesystem (for local development)
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            if (data && typeof data.pdfPath === 'string' && typeof data.originalFilename === 'string' && typeof data.token === 'string') {
                // Store in memory for future access
                SESSION_STORE.set(tokenId, data as SessionData);
                return data as SessionData;
            } else {
                console.error(`Invalid session data format in ${filePath}`);
                return null;
            }
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error reading session file ${filePath}:`, error);
        return null;
    }
}

export function saveSessionData(tokenId: string, data: SessionData): void {
    // Always store in memory first - this works everywhere
    SESSION_STORE.set(tokenId, data);
    
    // Try filesystem storage as backup, but don't fail if it doesn't work
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.warn(`Error saving to filesystem (expected in serverless):`, error);
        // Continue execution - in-memory storage is still working
    }
}

export function deleteSessionFile(tokenId: string): void {
    // Remove from in-memory storage
    SESSION_STORE.delete(tokenId);
    
    // Try to remove from filesystem too
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(`Error deleting session file ${filePath}:`, error);
    }
}