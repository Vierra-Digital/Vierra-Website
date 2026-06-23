// Idempotent importer: inserts recovered posts (scripts/_blogdata.json) into the DB.
// - Authors: matched by name (created if missing).
// - Posts: matched by unique slug (skipped if already present).
// Run with:  node --env-file=.env scripts/_blogimport.mjs
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const records = JSON.parse(readFileSync(new URL("./_blogdata.json", import.meta.url)));

const authorCache = new Map();
async function getAuthorId(name) {
  if (authorCache.has(name)) return authorCache.get(name);
  let author = await prisma.author.findFirst({ where: { name } });
  if (!author) {
    author = await prisma.author.create({ data: { name } });
    console.log(`  + author created: ${name} (id ${author.id})`);
  } else {
    console.log(`  = author exists:  ${name} (id ${author.id})`);
  }
  authorCache.set(name, author.id);
  return author.id;
}

let created = 0,
  skipped = 0;
try {
  for (const r of records) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: r.slug } });
    if (existing) {
      skipped++;
      console.log(`SKIP (exists): ${r.slug}`);
      continue;
    }
    const author_id = await getAuthorId(r.authorName);
    await prisma.blogPost.create({
      data: {
        author_id,
        title: r.title,
        description: r.description,
        content: r.content,
        slug: r.slug,
        tag: r.tag,
        published_date: r.publishedDate ? new Date(r.publishedDate) : new Date(),
        updated_date: r.updatedDate ? new Date(r.updatedDate) : null,
      },
    });
    created++;
    console.log(`CREATED: ${r.slug}`);
  }

  const totalPosts = await prisma.blogPost.count();
  const totalAuthors = await prisma.author.count();
  console.log(`\n================ DONE ================`);
  console.log(`Created: ${created}, Skipped(existing): ${skipped}`);
  console.log(`DB now has ${totalPosts} posts, ${totalAuthors} authors.`);
} catch (e) {
  console.error("IMPORT_ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
