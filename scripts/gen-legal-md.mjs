// One-off generator: extracts the <Section> prose from the legal TSX pages and
// writes faithful Markdown mirrors to content/md/. Re-run after editing a legal page.
import fs from "fs";
import path from "path";
import TurndownService from "turndown";

const ROOT = process.cwd();

const PAGES = [
  { slug: "terms-of-service", title: "Terms of Service", updated: "January 15th, 2025" },
  { slug: "privacy-policy", title: "Privacy Policy", updated: "January 16th, 2025" },
  { slug: "work-policy", title: "Work Policy", updated: "January 7th, 2025" },
];

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "_",
});
turndown.remove(["script", "style"]);

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Normalize JSX prose into plain HTML that turndown understands.
function jsxToHtml(jsx) {
  let html = jsx;
  // <Link href="x"> -> <a href="x">
  html = html.replace(/<Link\b/g, "<a").replace(/<\/Link>/g, "</a>");
  // Drop JSX whitespace/expression spacers like {' '} or {" "}
  html = html.replace(/\{['"`]\s*['"`]\}/g, " ");
  // Preserve href on anchors; strip every other attribute from known tags.
  html = html.replace(/<a\b[^>]*?\shref="([^"]*)"[^>]*>/g, '<a href="$1">');
  html = html.replace(/<a\b(?![^>]*href=)[^>]*>/g, "<a>");
  html = html.replace(
    /<(p|ul|ol|li|strong|b|em|i|span|div|h[1-6]|br|hr|table|thead|tbody|tr|td|th|sup|sub)\b[^>]*>/g,
    "<$1>"
  );
  return html;
}

for (const page of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, "pages", `${page.slug}.tsx`), "utf8");
  const re = /<Section\b[^>]*\btitle="([^"]*)"[^>]*>([\s\S]*?)<\/Section>/g;

  const out = [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `source: https://vierradev.com/${page.slug}`,
    "---",
    "",
    `# ${page.title}`,
    "",
    `_Last Updated ${page.updated}_`,
    "",
  ];

  let m;
  let n = 0;
  while ((m = re.exec(src)) !== null) {
    n += 1;
    const heading = decodeEntities(m[1]);
    const body = turndown.turndown(jsxToHtml(m[2])).replace(/\n{3,}/g, "\n\n").trim();
    out.push(`## ${heading}`, "", body, "");
  }

  out.push("---", `[View on vierradev.com](https://vierradev.com/${page.slug})`, "");
  const dest = path.join(ROOT, "content", "md", `${page.slug}.md`);
  fs.writeFileSync(dest, out.join("\n"));
  console.log(`Wrote ${dest} (${n} sections)`);
}
