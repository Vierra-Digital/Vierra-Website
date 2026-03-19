import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { toContactsCsv } from "@/lib/contacts/csv";

function asStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0]?.trim() || "" : v?.trim() || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  const accountEmail = asStr(req.query.accountEmail).toLowerCase();
  const search = asStr(req.query.search);
  const source = asStr(req.query.source).toUpperCase();
  const tagIds = asStr(req.query.tagIds)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const where: any = { userId };
  if (accountEmail) where.accountEmail = accountEmail;
  if (source && ["MANUAL", "GMAIL", "CSV"].includes(source)) where.source = source;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { business: { contains: search, mode: "insensitive" } },
    ];
  }
  if (tagIds.length > 0) {
    where.tags = {
      some: {
        tagId: { in: tagIds },
      },
    };
  }

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const csv = toContactsCsv(
    contacts.map((contact) => ({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      business: contact.business || "",
      website: contact.website || "",
      address: contact.address || "",
      tags: contact.tags.map((assignment) => assignment.tag.name).join("|"),
    }))
  );

  const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}
