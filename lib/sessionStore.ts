import fs from 'fs';
import path from 'path';

export interface SessionData {
    token: string;
    originalFilename: string;
    pdfPath: string;
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

const sessionsDir = path.resolve(process.cwd(), 'public', 'signing_sessions');

if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

export function getSessionData(tokenId: string): SessionData | null {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            if (data && typeof data.pdfPath === 'string' && typeof data.originalFilename === 'string' && typeof data.token === 'string') {
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
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error saving session file ${filePath}:`, error);
    }
}

export function deleteSessionFile(tokenId: string): void {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(`Error deleting session file ${filePath}:`, error);
    }
}