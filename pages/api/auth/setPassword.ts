import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and password are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long." });
        }

        const resetRecord = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetRecord) {
            return res.status(400).json({ message: "Invalid or expired link. Please request a new one." });
        }

        if (resetRecord.expiresAt < new Date()) {
            await prisma.passwordResetToken.delete({ where: { token } });
            return res.status(400).json({ message: "This link has expired. Please request a new one." });
        }

        const encryptedPassword = encrypt(password);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetRecord.userId },
                data: { passwordEnc: encryptedPassword },
            }),
            prisma.passwordResetToken.delete({ where: { token } }),
        ]);

        return res.status(200).json({ message: "Password set successfully. You can now log in." });
    } catch (e) {
        console.error("auth/setPassword", e);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
