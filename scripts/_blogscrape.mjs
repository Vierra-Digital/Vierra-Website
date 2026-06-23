// Read-only scraper: recovers blog posts from the live (statically cached) production
// pages and writes them to scripts/_blogdata.json. Does NOT touch the database.
import { writeFileSync } from "node:fs";

const TAG_URLS = [
  "https://vierradev.com/blog/tag/AI%20%26%20Automation",
  "https://vierradev.com/blog/tag/Leadership",
  "https://vierradev.com/blog/tag/Management",
  "https://vierradev.com/blog/tag/Marketing",
  "https://vierradev.com/blog/tag/Technology",
  "https://vierradev.com/blog/tag/Case%20Studies",
  "https://vierradev.com/blog/tag/Finance",
  "https://vierradev.com/blog/tag/Sales",
];

const UA = { "User-Agent": "Mozilla/5.0 (recovery-migration)" };

function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return { status: res.status, data: null };
  const html = await res.text();
  return { status: res.status, data: extractNextData(html) };
}

// 1) Collect unique slugs from the tag pages
const slugs = new Set();
for (const url of TAG_URLS) {
  const { status, data } = await getJson(url);
  const posts = data?.props?.pageProps?.posts || [];
  console.error(`tag ${decodeURIComponent(url.split("/tag/")[1])}: ${status}, ${posts.length} posts`);
  for (const p of posts) if (p.slug) slugs.add(p.slug);
}
console.error(`\nUnique slugs found: ${slugs.size}`);

// 2) Fetch each detail page for full content
const records = [];
const failed = [];
for (const slug of slugs) {
  const url = `https://vierradev.com/blog/${slug}`;
  const { status, data } = await getJson(url);
  const pp = data?.props?.pageProps;
  if (status !== 200 || !pp || !pp.title || !pp.content) {
    failed.push({ slug, status, hasProps: !!pp });
    console.error(`  MISS ${slug} (status ${status}, content ${(pp?.content || "").length})`);
    continue;
  }
  records.push({
    slug,
    title: pp.title,
    description: pp.description ?? null,
    content: pp.content,
    tag: pp.tag ?? null,
    authorName: pp.author?.name ?? "Vierra",
    publishedDate: pp.publishedDate ?? null,
    updatedDate: pp.updatedDate ?? null,
  });
  console.error(`  OK   ${slug}  [${pp.author?.name}]  ${(pp.content || "").length} chars`);
}

writeFileSync(new URL("./_blogdata.json", import.meta.url), JSON.stringify(records, null, 2));

console.error("\n================ SUMMARY ================");
console.error(`Recovered: ${records.length} posts`);
console.error(`Failed:    ${failed.length}`);
const authors = [...new Set(records.map((r) => r.authorName))];
console.error(`Authors:   ${authors.join(", ")}`);
console.error("\nTitles:");
for (const r of records) console.error(`  - [${r.tag}] ${r.title}  (${r.slug})`);
if (failed.length) {
  console.error("\nFailed slugs:");
  for (const f of failed) console.error(`  - ${f.slug} (${f.status})`);
}
