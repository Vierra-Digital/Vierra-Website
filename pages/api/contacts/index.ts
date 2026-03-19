import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { syncContactsSpreadsheetForUser } from "@/lib/contacts/xlsx";

function asStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function asQueryStr(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  const userId = Number((session.user as any).id);

  if (req.method === "GET") {
    const accountEmail = asQueryStr(req.query.accountEmail).trim().toLowerCase();
    const search = asQueryStr(req.query.search).trim();
    const source = asQueryStr(req.query.source).trim().toUpperCase();
    const tagIds = asQueryStr(req.query.tagIds)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const pageRaw = Number(asQueryStr(req.query.page));
    const limitRaw = Number(asQueryStr(req.query.limit));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 50;

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

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.status(200).json({
      contacts: contacts.map((contact) => ({
        ...contact,
        tags: contact.tags.map((assignment) => assignment.tag),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    return;
  }

  if (req.method === "POST") {
    const accountEmail = asStr(req.body?.accountEmail).toLowerCase() || null;
    const email = asStr(req.body?.email).toLowerCase();
    if (!email) {
      res.status(400).json({ message: "Email is required." });
      return;
    }

    const created = await prisma.contact.create({
      data: {
        userId,
        accountEmail,
        source: "MANUAL",
        firstName: asStr(req.body?.firstName) || null,
        lastName: asStr(req.body?.lastName) || null,
        email,
        phone: asStr(req.body?.phone) || null,
        business: asStr(req.body?.business) || null,
        website: asStr(req.body?.website) || null,
        address: asStr(req.body?.address) || null,
      },
    });
    await syncContactsSpreadsheetForUser({ userId });
    res.status(201).json({ contact: created });
    return;
  }

  res.status(405).json({ message: "Method Not Allowed" });
}
