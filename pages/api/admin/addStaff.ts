import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await requireSession(req, res);
    if (!session) return res.status(401).json({ message: "Not authenticated" });

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const { name, email, position, country, company_email, mentor, time_zone, password } = req.body;

        // Validate required fields
        if (!name || !email || !position || !country || !time_zone) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Encrypt the password (default to "Password" if not provided)
        const passwordToUse = password || "Password";
        const encryptedPassword = encrypt(passwordToUse);

        // Create the new staff member
        const newUser = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.trim(),
                passwordEnc: encryptedPassword,
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

        return res.status(201).json({
            message: "Staff member created successfully",
            user: newUser,
        });
    } catch (e) {
        console.error("admin/addStaff", e);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
