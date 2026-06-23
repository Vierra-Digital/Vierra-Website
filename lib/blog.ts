import { prisma } from "@/lib/prisma";

/**
 * Centralized blog data access. Every blog query lives here so the pages, API
 * routes, RSS feed, sitemap, and markdown mirror share one implementation and a
 * single JSON-safe serialization step (Dates -> ISO strings), instead of each
 * consumer re-writing the same Prisma calls and date mapping.
 */

export type SerializedPost = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  slug: string;
  tag: string | null;
  visits: number | null;
  published_date: string;
  updated_date: string | null;
  author: { name: string };
};

// Always pull just the author name alongside a post.
const withAuthorName = { include: { author: { select: { name: true } } } } as const;

// Convert a Prisma BlogPost (+author) into a JSON-serializable plain object.
// Centralizing this prevents `Date` fields (e.g. created_at) from leaking into
// getServerSideProps/getStaticProps props, which Next cannot serialize.
function serialize(post: {
  id: string;
  title: string;
  description: string | null;
  content: string;
  slug: string;
  tag: string | null;
  visits: number | null;
  published_date: Date;
  updated_date: Date | null;
  author: { name: string };
}): SerializedPost {
  return {
    id: post.id,
    title: post.title,
    description: post.description ?? null,
    content: post.content,
    slug: post.slug,
    tag: post.tag ?? null,
    visits: post.visits ?? null,
    published_date: post.published_date.toISOString(),
    updated_date: post.updated_date ? post.updated_date.toISOString() : null,
    author: { name: post.author?.name ?? "Vierra" },
  };
}

/* ----------------------------- Reads ----------------------------- */

export async function getLatestPosts(limit = 90): Promise<SerializedPost[]> {
  const posts = await prisma.blogPost.findMany({
    orderBy: { published_date: "desc" },
    take: limit,
    ...withAuthorName,
  });
  return posts.map(serialize);
}

export async function getPostsPage(page = 1, limit = 20): Promise<SerializedPost[]> {
  const posts = await prisma.blogPost.findMany({
    orderBy: { published_date: "desc" },
    skip: (Math.max(1, page) - 1) * limit,
    take: limit,
    ...withAuthorName,
  });
  return posts.map(serialize);
}

export async function getPostBySlug(slug: string): Promise<SerializedPost | null> {
  const post = await prisma.blogPost.findUnique({ where: { slug }, ...withAuthorName });
  return post ? serialize(post) : null;
}

export async function getRelatedPosts(
  opts: { slug: string; tag: string | null; authorName: string },
  limit = 3
): Promise<SerializedPost[]> {
  const tagList = opts.tag ? opts.tag.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const posts = await prisma.blogPost.findMany({
    where: {
      AND: [
        { slug: { not: opts.slug } },
        {
          OR: [
            ...tagList.map((t) => ({ tag: { contains: t, mode: "insensitive" as const } })),
            { author: { name: opts.authorName } },
          ],
        },
      ],
    },
    orderBy: { published_date: "desc" },
    take: limit,
    ...withAuthorName,
  });
  return posts.map(serialize);
}

export async function getPostsByTag(tag: string, limit = 50): Promise<SerializedPost[]> {
  const posts = await prisma.blogPost.findMany({
    where: { tag: { contains: tag, mode: "insensitive" } },
    orderBy: { published_date: "desc" },
    take: limit,
    ...withAuthorName,
  });
  return posts.map(serialize);
}

export async function getPostsByAuthor(name: string, limit = 50): Promise<SerializedPost[]> {
  const posts = await prisma.blogPost.findMany({
    where: { author: { name } },
    orderBy: { published_date: "desc" },
    take: limit,
    ...withAuthorName,
  });
  return posts.map(serialize);
}

export async function getAllSlugs(limit?: number): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({
    select: { slug: true },
    orderBy: { published_date: "desc" },
    ...(limit ? { take: limit } : {}),
  });
  return posts.map((p) => p.slug);
}

export async function getAllTags(): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({ select: { tag: true } });
  const set = new Set<string>();
  posts.forEach((p) =>
    p.tag?.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => set.add(t))
  );
  return [...set];
}

export async function getAllAuthorNames(): Promise<string[]> {
  const authors = await prisma.author.findMany({ select: { name: true } });
  return authors.map((a) => a.name);
}

/* --------------------------- Mutations --------------------------- */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function findOrCreateAuthor(name: string) {
  const clean = name || "Unknown";
  const existing = await prisma.author.findFirst({ where: { name: clean } });
  return existing ?? prisma.author.create({ data: { name: clean } });
}

export interface PostWriteInput {
  title: string;
  description?: string | null;
  content: string;
  tag?: string | null;
  authorName: string;
  date?: string | null;
}

export async function createPost(input: PostWriteInput) {
  const author = await findOrCreateAuthor(input.authorName);
  return prisma.blogPost.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      tag: input.tag ?? null,
      author_id: author.id,
      slug: slugify(String(input.title || "untitled")),
      published_date: input.date ? new Date(input.date) : new Date(),
    },
  });
}

export async function updatePost(id: string, input: PostWriteInput) {
  const author = await findOrCreateAuthor(input.authorName);
  const prev = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } });
  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description ?? null,
      content: input.content,
      tag: input.tag ?? null,
      author_id: author.id,
      slug: slugify(String(input.title || "untitled")),
      published_date: input.date ? new Date(input.date) : new Date(),
      updated_date: new Date(),
    },
  });
  return { post, prevSlug: prev?.slug ?? null };
}

export async function deletePost(id: string) {
  return prisma.blogPost.delete({ where: { id }, select: { slug: true } });
}

/** Atomically increment a post's view counter. No-ops if the slug doesn't exist. */
export async function incrementVisits(slug: string): Promise<void> {
  await prisma.blogPost.update({
    where: { slug },
    data: { visits: { increment: 1 } },
  });
}
