import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const { id, title, description, content, date, tag, authorName, isTest } = req.body || {};
      const published_date = date ? new Date(date) : new Date();
      const author = await prisma.author.upsert({
        where: { name: authorName || "Unknown" },
        update: {},
        create: { name: authorName || "Unknown" },
      });

      const baseSlug = slugify(String(title || "untitled"));
      const slug = isTest ? `test-${baseSlug}-${Date.now()}` : baseSlug;

      if (req.method === "PUT" && id) {
        const post = await prisma.blogPost.update({
          where: { id: Number(id) },
          data: {
            title,
            description,
            content,
            tag,
            author_id: author.id,
            published_date,
            is_test: Boolean(isTest),
            slug,
          },
        });
        return res.status(200).json({ id: post.id });
      }

      const post = await prisma.blogPost.create({
        data: {
          title,
          description,
          content,
          tag,
          author_id: author.id,
          published_date,
          is_test: Boolean(isTest),
          slug,
        },
      });

      // For test posts, return a temporary link (24h implied by a note; not enforced here)
      const link = isTest ? `/blog/test/${post.slug}` : `/blog/${post.slug}`;
      return res.status(200).json({ id: post.id, link, isTest: Boolean(isTest) });
    } catch (e) {
      console.error("blog admin post", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ message: "Missing id" });
      await prisma.blogPost.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("blog admin delete", e);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = toSlug(base)
  let i = 1
  while (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${toSlug(base)}-${i++}`
  }
  return slug
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || (session.user as any)?.role === "user") {
    return res.status(401).json({ error: "Unauthorized" })
  }

  try {
    if (req.method === "POST") {
      const {
        title,
        description,
        content,
        date,
        tag,
        authorName,
      } = req.body as {
        title: string
        description?: string | null
        content: string
        date?: string | null
        tag?: string | null
        authorName?: string | null
      }

      if (!title || !content) return res.status(400).json({ error: "title and content are required" })

      const author = authorName
        ? await prisma.author.upsert({
            where: { email: null as any }, // workaround unique requirement; use name lookup below
            update: {},
            create: { name: authorName },
          }).catch(async () => {
            const existing = await prisma.author.findFirst({ where: { name: authorName } })
            return existing ?? (await prisma.author.create({ data: { name: authorName } }))
          })
        : await prisma.author.findFirst().then((a) => a ?? prisma.author.create({ data: { name: "Vierra" } }))

      const slug = await ensureUniqueSlug(title)

      const post = await prisma.blogPost.create({
        data: {
          title,
          description: description ?? null,
          content,
          tag: tag ?? null,
          slug,
          author_id: author.id,
          published_date: date ? new Date(date) : new Date(),
        },
      })
      return res.status(201).json({ post })
    }

    if (req.method === "PUT") {
      const { id, title, description, content, date, tag, authorName } = req.body as {
        id: number
        title?: string
        description?: string | null
        content?: string
        date?: string | null
        tag?: string | null
        authorName?: string | null
      }
      if (!id) return res.status(400).json({ error: "id required" })

      let authorId: number | undefined
      if (authorName) {
        const author =
          (await prisma.author.findFirst({ where: { name: authorName } })) ??
          (await prisma.author.create({ data: { name: authorName } }))
        authorId = author.id
      }

      const update: any = {}
      if (title) update.title = title
      if (description !== undefined) update.description = description
      if (content) update.content = content
      if (tag !== undefined) update.tag = tag
      if (date) update.published_date = new Date(date)
      if (authorId) update.author_id = authorId

      const post = await prisma.blogPost.update({ where: { id }, data: update })
      return res.status(200).json({ post })
    }

    if (req.method === "DELETE") {
      const { id } = req.query
      const numId = Number(id)
      if (!numId) return res.status(400).json({ error: "id required" })
      await prisma.blogPost.delete({ where: { id: numId } })
      return res.status(204).end()
    }

    return res.status(405).json({ error: "Method not allowed" })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: "Internal Server Error" })
  }
}


