import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.query.token as string;
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ message: "Missing password" });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sess = await tx.onboardingSession.findUnique({
      where: { id: token },
      include: { client: true },
    });
    if (!sess) throw new Error("Session not found");
    if (!sess.client) throw new Error("Client not found");
    let user = await tx.user.findUnique({ where: { email: sess.client.email } });
    if (!user) {
      user = await tx.user.create({
        data: {
          email: sess.client.email.toLowerCase(),
          passwordEnc: await bcrypt.hash(password, 10),
          role: "user",
          name: sess.client.name,
        },
      });
    } else if (!user.name && sess.client.name) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { name: sess.client.name },
      });
    }
    await tx.client.update({
      where: { id: sess.clientId },
      data: { userId: user.id },
    });
  });

  return res.status(200).json({ ok: true });
}
