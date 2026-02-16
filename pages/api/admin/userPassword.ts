import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method Not Allowed" });

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });
  const role = (session.user as any)?.role;
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });

  const id = req.query.id;
  const userId = Number(Array.isArray(id) ? id[0] : id);
  if (!userId) return res.status(400).json({ message: "id is required" });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordEnc: true } });
    if (!user) return res.status(404).json({ message: "User not found" });
    
    if (!user.passwordEnc) {
      return res.status(200).json({ id: userId, password: null });
    }
    let password: string | null = null;
    try {
      password = decrypt(user.passwordEnc);
    } catch {
      console.log(`Password for user ${userId} cannot be decrypted - might be bcrypt hash or other format`);
      return res.status(200).json({ 
        id: userId, 
        password: null,
        error: "Password is encrypted/hashed and cannot be revealed"
      });
    }
    
    return res.status(200).json({ id: userId, password });
  } catch (e) {
    console.error("admin/userPassword", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}


