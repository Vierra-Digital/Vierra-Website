import fs from 'fs';
import path from 'path';

interface SessionData {
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
    status: string;
    createdAt: string;
}

const sessionsDir = path.resolve(process.cwd(), 'public', 'signing_sessions');

if (!fs.existsSync(sessionsDir)) {
    console.log(`Creating sessions directory: ${sessionsDir}`);
    fs.mkdirSync(sessionsDir, { recursive: true });
}

export function getSessionData(tokenId: string): SessionData | null {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    console.log(`[getSessionData] Attempting to read session file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.warn(`[getSessionData] Session file not found: ${filePath}`);
        return null;
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`[getSessionData] Successfully read session file: ${filePath}`);
        const data = JSON.parse(fileContent) as SessionData;
        if (!data.pdfPath || !data.coordinates) {
            console.error(`[getSessionData] Incomplete data in session file: ${filePath}`);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[getSessionData] Error reading or parsing session file ${filePath}:`, error);
        throw new Error(`Failed to process session file for token: ${tokenId}`);
    }
}

export function saveSessionData(tokenId: string, data: SessionData): void {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    console.log(`[saveSessionData] Attempting to save session file: ${filePath}`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`[saveSessionData] Successfully saved session file: ${filePath}`);
    } catch (error) {
        console.error(`[saveSessionData] Error saving session file ${filePath}:`, error);
        throw new Error(`Failed to save session data for token: ${tokenId}`);
    }
}

export function deleteSessionFile(tokenId: string): void {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted session file: ${filePath}`);
        } else {
            console.warn(`Session file not found for deletion: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error deleting session file ${filePath}:`, error);
    }
}