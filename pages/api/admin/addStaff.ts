import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { sendStaffSetPasswordEmail } from "@/lib/emailSender";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await requireSession(req, res);
    if (!session) return res.status(401).json({ message: "Not authenticated" });

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const { name, email, position, country, company_email, mentor, time_zone } = req.body;

        if (!name || !email || !position || !country || !time_zone) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
        });

        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const staffEmail = email.trim().toLowerCase();
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const newUser = await prisma.user.create({
            data: {
                name: name.trim(),
                email: staffEmail,
                passwordEnc: null,
                role: "staff", // Staff role for panel access
                position: position.trim(),
                country: country.trim(),
                company_email: company_email?.trim() || null,
                mentor: mentor?.trim() || null,
                time_zone: time_zone.trim(),
                strikes: "0/3", // Default strikes
                status: "offline", // Default status
                emailNotifications: true,
                twoFactorEnabled: false,
                theme: "auto",
                language: "en",
            },
            select: {
                id: true,
                name: true,
                email: true,
                position: true,
                country: true,
                company_email: true,
                mentor: true,
                time_zone: true,
                strikes: true,
                status: true,
                lastActiveAt: true,
            },
        });

        await prisma.passwordResetToken.create({
            data: {
                token,
                userId: newUser.id,
                expiresAt,
            },
        });

        const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host || "vierradev.com"}`;
        const setPasswordLink = `${baseUrl}/set-password/${token}`;

        try {
            await sendStaffSetPasswordEmail(staffEmail, name.trim(), setPasswordLink);
        } catch (emailErr) {
            console.error("addStaff: Failed to send set-password email:", emailErr);
            await prisma.passwordResetToken.deleteMany({ where: { token } });
            await prisma.user.delete({ where: { id: newUser.id } });
            return res.status(500).json({ message: "Failed to send welcome email. Please try again." });
        }

        return res.status(201).json({
            message: "Staff member created successfully",
            user: newUser,
        });
    } catch (e) {
        console.error("admin/addStaff", e);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
