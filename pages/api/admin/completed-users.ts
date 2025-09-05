import { prisma } from "@/lib/prisma";
import type { NextApiRequest, NextApiResponse } from "next";
import { decrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const users = await prisma.user.findMany({
            where: {
                client: {
                    onboardingSessions: {
                        some: { status: "completed" },
                    },
                },
            },
            select: {
                id: true,
                email: true,
                passwordEnc: true,
                client: { 
                    select: { 
                        name: true,
                        businessName: true,
                        email: true,
                        onboardingSessions: {
                            where: { status: "completed" },
                            select: {
                                answers: true,
                                submittedAt: true
                            },
                            orderBy: { submittedAt: 'desc' },
                            take: 1
                        }
                    } 
                },
            },
        });

        const withDecrypted = users.map(u => ({
            ...u,
            password: u.passwordEnc ? decrypt(u.passwordEnc) : null,
            surveyAnswers: u.client?.onboardingSessions?.[0]?.answers || null,
            surveyDate: u.client?.onboardingSessions?.[0]?.submittedAt || null,
        }));

        res.json(withDecrypted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch completed users" });
    }
}
