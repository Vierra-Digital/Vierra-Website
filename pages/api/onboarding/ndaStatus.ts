import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "@/lib/prisma"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` })
  }

  const tokenId = typeof req.query.tokenId === "string" ? req.query.tokenId : ""
  if (!tokenId) {
    return res.status(400).json({ message: "tokenId is required." })
  }

  const stored = await prisma.storedFile.findFirst({
    where: { signingTokenId: tokenId },
    select: { pdfData: false, id: true, signingTokenId: true },
  })

  if (!stored) {
    return res.status(404).json({ signed: false })
  }

  const signingSession = await prisma.signingSession.findUnique({
    where: { token: tokenId },
    select: { status: true },
  })

  const signed = !signingSession || signingSession.status === "signed"

  return res.status(200).json({ signed })
}
