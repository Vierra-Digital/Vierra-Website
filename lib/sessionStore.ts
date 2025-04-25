import fs from 'fs';
import path from 'path';

interface SessionData {
    pdfPath: string;
    originalFilename: string;
    coordinates: {
        page: number;
        xRatio: number;
        yRatio: number;
        width: number;
        height: number;
    };
    createdAt: number;
}

const sessionsDir = path.resolve(process.cwd(), 'public', 'signing_sessions');

if (!fs.existsSync(sessionsDir)) {
    console.log(`Creating sessions directory: ${sessionsDir}`);
    fs.mkdirSync(sessionsDir, { recursive: true });
}

export function getSessionData(tokenId: string): SessionData | null {
    const filePath = path.join(sessionsDir, `${tokenId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent) as SessionData;
        } else {
            console.warn(`Session file not found: ${filePath}`);
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
        console.log(`Session data saved to: ${filePath}`);
    } catch (error) {
        console.error(`Error saving session file ${filePath}:`, error);
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