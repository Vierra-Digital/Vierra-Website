import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  for (const table of ["blog_posts", "authors", "blog_images"]) {
    const cols = await prisma.$queryRawUnsafe(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_name = $1 order by ordinal_position`,
      table
    );
    console.log(`\n== ${table} ==`);
    if (!cols.length) { console.log("  (table not found)"); continue; }
    for (const c of cols) console.log(`  ${c.column_name} :: ${c.data_type} ${c.is_nullable === "YES" ? "NULL" : "NOT NULL"}${c.column_default ? " default " + c.column_default : ""}`);
  }
} catch (e) {
  console.error("ERR:", e.message);
} finally {
  await prisma.$disconnect();
}
