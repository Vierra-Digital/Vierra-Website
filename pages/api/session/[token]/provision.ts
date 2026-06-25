import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createSupabaseAuthUser } from "@/lib/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.query.token as string;
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ message: "Missing password" });

  const sess = await prisma.onboardingSession.findUnique({
    where: { id: token },
    include: { clients: true },
  });
  if (!sess) return res.status(404).json({ message: "Session not found" });
  if (!sess.clients) return res.status(404).json({ message: "Client not found" });

  const email = sess.clients.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const newSupabaseUserId = existingUser ? null : (await createSupabaseAuthUser(email, password)).id;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const innerSess = await tx.onboardingSession.findUnique({
      where: { id: token },
      include: { clients: true },
    });
    if (!innerSess) throw new Error("Session not found");
    if (!innerSess.clients) throw new Error("Client not found");
    let user = await tx.user.findUnique({ where: { email: innerSess.clients.email.toLowerCase() } });
    if (!user) {
      user = await tx.user.create({
        data: {
          id: newSupabaseUserId!,
          email: innerSess.clients.email.toLowerCase(),
          name: innerSess.clients.name,
        },
      });
    } else if (!user.name && innerSess.clients.name) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { name: innerSess.clients.name },
      });
    }
    await tx.client.update({
      where: { id: innerSess.client_id },
      data: { user_id: user.id },
    });
  });

  return res.status(200).json({ ok: true });
}
