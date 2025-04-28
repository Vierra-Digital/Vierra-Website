import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getSessionData, saveSessionData, SessionData } from '@/lib/sessionStore';
import { sendSignedDocumentEmail } from '@/lib/emailSender';

interface SubmitSignatureBody {
    tokenId: string;
    signature: string;
    position: SessionData['coordinates'];
}

const signedPdfsDir = path.resolve(process.cwd(), 'public', 'signed_pdfs');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        try {
            await fs.mkdir(signedPdfsDir, { recursive: true });
        } catch (mkdirError: unknown) {
            if (!(typeof mkdirError === 'object' && mkdirError !== null && 'code' in mkdirError && mkdirError.code === 'EEXIST')) {
                console.error(`[submit-signature] Critical error creating directory ${signedPdfsDir}:`, mkdirError);
                const errorMessage = mkdirError instanceof Error ? mkdirError.message : String(mkdirError);
                throw new Error(`Failed to prepare storage directory: ${errorMessage}`);
            }
            console.log(`[submit-signature] Directory ${signedPdfsDir} already exists.`);
        }

        const { tokenId, signature, position }: SubmitSignatureBody = req.body;

        if (!tokenId || !signature || !position) {
            return res.status(400).json({ message: 'Missing required fields: tokenId, signature, or position.' });
        }
        if (!signature.startsWith('data:image/png;base64,')) {
             return res.status(400).json({ message: 'Invalid signature format. Expected base64 PNG data URL.' });
        }

        const sessionData = getSessionData(tokenId);
        if (!sessionData) {
            return res.status(404).json({ message: 'Session not found.' });
        }
        if (sessionData.status === 'signed') {
             return res.status(400).json({ message: 'Document already signed.' });
        }

        const originalPdfPathRel = sessionData.pdfPath.replace(/^\//, '');
        const originalPdfPathAbs = path.join(process.cwd(), 'public', originalPdfPathRel);

        let pdfBytes: Buffer;
        try {
            pdfBytes = await fs.readFile(originalPdfPathAbs);
        } catch (readError) {
             console.error(`[submit-signature] Failed to read original PDF: ${originalPdfPathAbs}`, readError);
             return res.status(500).json({ message: 'Failed to load original document.' });
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        const targetPageNumber = position.page;
        if (targetPageNumber < 1 || targetPageNumber > pages.length) {
            return res.status(400).json({ message: `Invalid page number: ${targetPageNumber}.` });
        }
        const targetPage = pages[targetPageNumber - 1];
        const { width: pageOriginalWidth, height: pageOriginalHeight } = targetPage.getSize();

        const signaturePngBase64 = signature.replace('data:image/png;base64,', '');
        const signatureBytes = Buffer.from(signaturePngBase64, 'base64');
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        signatureImage.scale(1);

        const embedX = position.xRatio * pageOriginalWidth;
        const embedY = pageOriginalHeight - (position.yRatio * pageOriginalHeight) - (position.height);
        const embedWidth = position.width;
        const embedHeight = position.height;

        targetPage.drawImage(signatureImage, {
            x: embedX,
            y: embedY,
            width: embedWidth,
            height: embedHeight,
        });

        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        targetPage.drawText(`Signed on: ${new Date().toLocaleString()}`, {
            x: embedX,
            y: embedY - 12,
            size: 8,
            font: helveticaFont,
            color: rgb(0.5, 0.5, 0.5),
        });

        const signedPdfBytes = await pdfDoc.save();
        const signedPdfFilename = `${tokenId}_signed.pdf`;
        const signedPdfPathAbs = path.join(signedPdfsDir, signedPdfFilename);

        try {
            await fs.writeFile(signedPdfPathAbs, signedPdfBytes);
            console.log(`[submit-signature] Successfully wrote signed PDF to ${signedPdfPathAbs}`);
        } catch (writeError) {
             console.error(`[submit-signature] ERROR writing signed PDF to ${signedPdfPathAbs}:`, writeError);
             return res.status(500).json({ message: 'Failed to save the signed document.' });
        }

        try {
            sessionData.status = 'signed';
            sessionData.signedPdfPath = `/signed_pdfs/${signedPdfFilename}`;
            saveSessionData(tokenId, sessionData);
            console.log(`[submit-signature] Successfully updated session status for token ${tokenId}`);
        } catch (sessionError) {
            console.warn(`[submit-signature] WARNING: Failed to update session data for token ${tokenId} after saving PDF:`, sessionError);
        }

        try {
            const emailSubject = `Signed Document: ${sessionData.originalFilename}`;
            const emailText = `The document "${sessionData.originalFilename}" (Token: ${tokenId}) has been signed. Find the signed version attached.`;
            await sendSignedDocumentEmail(emailSubject, emailText, signedPdfPathAbs, signedPdfFilename);
            console.log(`[submit-signature] Successfully sent signed document email for token ${tokenId}`);
        } catch (emailError) {
            console.warn(`[submit-signature] WARNING: Failed to send signed document email for token ${tokenId} after saving PDF:`, emailError);
        }

        res.status(200).json({ message: 'Signature submitted and document saved successfully.' });

    } catch (error: unknown) {
        console.error('[submit-signature] General error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred during signature submission.';
        res.status(500).json({ message });
    }
}
