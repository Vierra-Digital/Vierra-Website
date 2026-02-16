import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await requireSession(req, res);
    if (!session) return res.status(401).json({ message: "Not authenticated" });

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters long" });
        }

        const userEmail = (session.user as any)?.email;
        if (!userEmail) {
            return res.status(400).json({ message: "User email not found in session" });
        }
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true, passwordEnc: true },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.passwordEnc) {
            return res.status(400).json({ message: "User does not have a password set" });
        }
        let storedPlain: string;
        try {
            storedPlain = decrypt(user.passwordEnc);
        } catch {
            return res.status(400).json({ message: "Invalid stored password format" });
        }
        const isCurrentPasswordValid =
            storedPlain.length === currentPassword.length &&
            crypto.timingSafeEqual(Buffer.from(storedPlain), Buffer.from(currentPassword));

        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        const encryptedNewPassword = encrypt(newPassword);
        await prisma.user.update({
            where: { email: userEmail },
            data: { passwordEnc: encryptedNewPassword },
        });

        return res.status(200).json({ message: "Password changed successfully" });
    } catch (e) {
        console.error("profile/changePassword", e);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
