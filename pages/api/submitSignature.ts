import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getSessionData, saveSessionData, PdfField } from '@/lib/sessionStore';
import { sendSignedDocumentEmail, sendSignerCopyEmail } from '@/lib/emailSender';
import { prisma } from '@/lib/prisma';

interface SubmitSignatureBody {
    tokenId: string;
    signature?: string;
    position?: { page: number; xRatio: number; yRatio: number; width: number; height: number };
    /** New format: field values by field id */
    signatures?: Record<string, string>;
    textValues?: Record<string, string>;
    email?: string;
}

const signedPdfsDir = process.env.NODE_ENV === 'production' 
    ? path.resolve('/tmp', 'signed_pdfs')
    : path.resolve(process.cwd(), 'public', 'signed_pdfs');

const signingPdfsDir = process.env.NODE_ENV === 'production'
    ? path.resolve('/tmp', 'signing_pdfs')
    : path.resolve(process.cwd(), 'public', 'signing_pdfs');

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

        const { tokenId, signature, position, signatures, textValues, email }: SubmitSignatureBody = req.body;

        if (!tokenId) {
            return res.status(400).json({ message: 'Missing required field: tokenId.' });
        }

        const sessionData = getSessionData(tokenId);
        if (!sessionData) {
            return res.status(404).json({ message: 'Session not found.' });
        }
        if (sessionData.status === 'signed') {
             return res.status(400).json({ message: 'Document already signed.' });
        }

        const fields = sessionData.fields ?? (position ? [{
            type: 'signature' as const,
            page: position.page,
            xRatio: position.xRatio,
            yRatio: position.yRatio,
            width: position.width,
            height: position.height,
            id: 'legacy',
        }] : []);

        const useLegacy = !sessionData.fields && signature && position;
        if (useLegacy) {
            if (!signature.startsWith('data:image/png;base64,')) {
                return res.status(400).json({ message: 'Invalid signature format. Expected base64 PNG data URL.' });
            }
        } else {
            const sigFields = fields.filter((f: PdfField) => f.type === 'signature');
            if (sigFields.length === 0) {
                return res.status(400).json({ message: 'No signature fields in session.' });
            }
            const sigs = signatures ?? (signature ? { [sigFields[0].id ?? 'legacy']: signature } : {});
            for (const f of sigFields) {
                const sid = f.id ?? 'legacy';
                if (!sigs[sid] || !sigs[sid].startsWith('data:image/png;base64,')) {
                    return res.status(400).json({ message: `Missing or invalid signature for field ${sid}.` });
                }
            }
        }

        let pdfBytes: Buffer;
        
        if (sessionData.pdfBase64) {
            console.log(`[submit-signature] Using base64 encoded PDF from session data for token ${tokenId}`);
            pdfBytes = Buffer.from(sessionData.pdfBase64, 'base64');
        } else {
            const originalPdfPathRel = sessionData.pdfPath.replace(/^\//, '');
            const originalPdfPathAbs = process.env.NODE_ENV === 'production'
                ? path.join('/tmp', originalPdfPathRel) // In production, look in /tmp
                : path.join(process.cwd(), 'public', originalPdfPathRel); // In dev, use public dir

            try {
                console.log(`[submit-signature] Reading PDF from filesystem at ${originalPdfPathAbs}`);
                pdfBytes = await fs.readFile(originalPdfPathAbs);
            } catch (readError) {
                console.error(`[submit-signature] Failed to read original PDF: ${originalPdfPathAbs}`, readError);
                return res.status(500).json({ message: 'Failed to load original document.' });
            }
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const sigs = signatures ?? (signature ? { legacy: signature } : {});
        const texts = textValues ?? {};
        const now = new Date();
        const dateStr = now.toLocaleDateString();

        for (const field of fields) {
            if (field.page < 1 || field.page > pages.length) continue;
            const targetPage = pages[field.page - 1];
            const { width: pageOriginalWidth, height: pageOriginalHeight } = targetPage.getSize();

            const embedX = field.xRatio * pageOriginalWidth;
            const embedY = pageOriginalHeight - (field.yRatio * pageOriginalHeight) - field.height;
            const embedW = field.width;
            const embedH = field.height;

            if (field.type === 'signature') {
                const sigData = sigs[field.id ?? 'legacy'];
                if (!sigData) continue;
                const sigPngBase64 = sigData.replace('data:image/png;base64,', '');
                const signatureBytes = Buffer.from(sigPngBase64, 'base64');
                const signatureImage = await pdfDoc.embedPng(signatureBytes);
                signatureImage.scale(1);
                targetPage.drawImage(signatureImage, {
                    x: embedX,
                    y: embedY,
                    width: embedW,
                    height: embedH,
                });
            } else if (field.type === 'date') {
                targetPage.drawText(dateStr, {
                    x: embedX,
                    y: embedY + embedH * 0.5 - 6,
                    size: Math.min(10, embedH * 0.6),
                    font: helveticaFont,
                    color: rgb(0.2, 0.2, 0.2),
                });
            } else if (field.type === 'text') {
                const value = texts[field.id ?? ''] ?? '';
                if (value) {
                    targetPage.drawText(value, {
                        x: embedX + 2,
                        y: embedY + embedH * 0.5 - 6,
                        size: Math.min(10, embedH * 0.6),
                        font: helveticaFont,
                        color: rgb(0.2, 0.2, 0.2),
                    });
                }
            }
        }

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
            sessionData.signedPdfPath = process.env.NODE_ENV === 'production' 
                ? `/tmp/signed_pdfs/${signedPdfFilename}` 
                : `/signed_pdfs/${signedPdfFilename}`;

            if (email) {
                sessionData.signerEmail = email;
            }
            saveSessionData(tokenId, sessionData);
            console.log(`[submit-signature] Successfully updated session status for token ${tokenId}`);
        } catch (sessionError) {
            console.warn(`[submit-signature] WARNING: Failed to update session data for token ${tokenId} after saving PDF:`, sessionError);
        }

        try {
            const storedFiles = await prisma.storedFile.findMany({
                where: { signingTokenId: tokenId, userId: { not: null } },
                select: { id: true },
            });
            if (storedFiles.length > 0) {
                const signingPdfPath = path.join(signingPdfsDir, `${tokenId}.pdf`);
                await fs.mkdir(signingPdfsDir, { recursive: true });
                await fs.writeFile(signingPdfPath, signedPdfBytes);
                console.log(`[submit-signature] Updated stored file with signed PDF for token ${tokenId}`);
            }
        } catch (updateError) {
            console.warn(`[submit-signature] WARNING: Failed to update stored file with signed PDF for token ${tokenId}:`, updateError);
        }

        if (process.env.NODE_ENV === 'production') {
            const emailPromises = [];
            const emailSubject = `Signed Document: ${sessionData.originalFilename}`;
            const emailText = `The document "${sessionData.originalFilename}" has been signed. See the signed version attached.`;
            emailPromises.push(
                sendSignedDocumentEmail(emailSubject, emailText, signedPdfPathAbs, signedPdfFilename)
                    .catch(emailError => {
                        console.warn(`[submit-signature] WARNING: Failed to send admin email for token ${tokenId}:`, emailError);
                        // Continue execution even if email fails
                    })
            );
            if (email) {
                emailPromises.push(
                    sendSignerCopyEmail(email, sessionData.originalFilename, signedPdfPathAbs)
                        .catch(signerEmailError => {
                            console.warn(`[submit-signature] WARNING: Failed to send signer email to ${email}:`, signerEmailError);
                            // Continue execution even if email fails
                        })
                );
            }
            
            await Promise.all(emailPromises);
            console.log(`[submit-signature] Email sending sequence completed for token ${tokenId}`);
        } else {
            try {
                const emailSubject = `Signed Document: ${sessionData.originalFilename}`;
                const emailText = `The document "${sessionData.originalFilename}" has been signed. See the signed version attached.`;
                await sendSignedDocumentEmail(emailSubject, emailText, signedPdfPathAbs, signedPdfFilename);
                console.log(`[submit-signature] Successfully sent signed document email for token ${tokenId}`);
            } catch (emailError) {
                console.warn(`[submit-signature] WARNING: Failed to send signed document email for token ${tokenId} after saving PDF:`, emailError);
            }

            if (email) {
                try {
                    await sendSignerCopyEmail(email, sessionData.originalFilename, signedPdfPathAbs);
                    console.log(`[submit-signature] Successfully sent signed document copy to signer at ${email}`);
                } catch (signerEmailError) {
                    console.warn(`[submit-signature] WARNING: Failed to send signed document copy to signer at ${email}:`, signerEmailError);
                }
            }
        }

        return res.status(200).json({ message: 'Signature submitted and document saved successfully.' });

    } catch (error: unknown) {
        console.error('[submit-signature] General error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred during signature submission.';
        res.status(500).json({ message });
    }
}
