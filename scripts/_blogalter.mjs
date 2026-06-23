// Additive, idempotent DB changes to make the overhauled blog_posts table
// match what the app needs: a `tag` column, a `visits` column, and a unique slug index.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const stmts = [
  `ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "tag" text`,
  `ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "visits" integer DEFAULT 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_key" ON "blog_posts" ("slug")`,
];
try {
  for (const sql of stmts) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK:", sql);
  }
  const cols = await prisma.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name='blog_posts' order by ordinal_position`
  );
  console.log("\nblog_posts columns now:", cols.map((c) => c.column_name).join(", "));
} catch (e) {
  console.error("ALTER_ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
