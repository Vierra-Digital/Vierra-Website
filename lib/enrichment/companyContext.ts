/**
 * Keyless company-context enrichment.
 *
 * Fetches a company's PUBLIC website server-side and parses free signals — name,
 * description, logo, socials, generic contact emails, and a detected tech stack.
 * No third-party API keys, no cost. Shallower than Apollo/Harmonic (no private
 * funding/revenue), but a genuinely useful "who is this company" card.
 *
 * Pure module (no imports) so it can be unit-tested standalone.
 */

export type SeoSnapshot = {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  hasCanonical: boolean;
  indexable: boolean; // no <meta robots noindex>
  hasViewport: boolean; // mobile-friendly signal
  openGraphCount: number;
  hasTwitterCard: boolean;
  structuredDataTypes: string[]; // JSON-LD @type values
  lang: string | null;
  hasFavicon: boolean;
  wordCount: number;
  https: boolean;
};

export type NewsItem = { title: string; link: string; date: string | null };

export type CompanyContext = {
  domain: string;
  url: string;
  name: string | null;
  description: string | null;
  logo: string | null;
  socials: Record<string, string>;
  emails: string[];
  tech: string[];
  seo: SeoSnapshot;
  news: NewsItem[];
  fetchedAt: string;
};

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 600_000; // cap parsed HTML size
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Normalize arbitrary input (domain, url, "www.x.com/path") to a hostname + https URL. */
export function normalizeDomain(input: string): { domain: string; url: string } | null {
  if (!input || typeof input !== "string") return null;
  let raw = input.trim().toLowerCase();
  if (!raw) return null;
  if (!/^https?:\/\//.test(raw)) raw = "https://" + raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  // SSRF guard: reject local / private / metadata hosts.
  if (
    !host.includes(".") ||
    host === "localhost" ||
    /(^|\.)local$/.test(host) ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "metadata.google.internal"
  ) {
    return null;
  }
  return { domain: host, url: `https://${host}/` };
}

// Signature table: label -> test over lowercased HTML, or a header check.
const TECH_HTML_SIGNATURES: Array<[string, RegExp]> = [
  ["Next.js", /\/_next\/|__next_data__/],
  ["React", /data-reactroot|react-dom|__next_data__/],
  ["Vue.js", /vuejs|__vue__|\bv-cloak\b/],
  ["WordPress", /wp-content|wp-includes/],
  ["Shopify", /cdn\.shopify\.com|shopify\.theme/],
  ["Wix", /static\.wixstatic\.com|wix\.com/],
  ["Squarespace", /squarespace\.com|static1\.squarespace/],
  ["Webflow", /\.webflow\.io|assets\.website-files\.com|webflow\.com/],
  ["Framer", /framerusercontent\.com|framer\.com/],
  ["HubSpot", /js\.hs-scripts\.com|hsforms|hubspot/],
  ["Marketo", /marketo|mktoforms/],
  ["Salesforce/Pardot", /pardot|salesforce/],
  ["Google Analytics", /google-analytics\.com|gtag\(|googletagmanager\.com\/gtag/],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js/],
  ["Segment", /cdn\.segment\.com/],
  ["Intercom", /widget\.intercom\.io|intercomcdn/],
  ["Drift", /js\.driftt\.com|drift\.com/],
  ["Zendesk", /zdassets\.com|zendesk/],
  ["Stripe", /js\.stripe\.com/],
  ["Klaviyo", /klaviyo/],
  ["Mailchimp", /chimpstatic\.com|mailchimp/],
  ["Typeform", /typeform\.com/],
  ["Calendly", /calendly\.com/],
  ["Cal.com", /cal\.com\/embed/],
  ["Hotjar", /static\.hotjar\.com|hotjar/],
  ["Facebook Pixel", /connect\.facebook\.net|fbq\(/],
  ["LinkedIn Insight", /snap\.licdn\.com/],
  ["jQuery", /jquery(\.min)?\.js|ajax\.googleapis\.com\/ajax\/libs\/jquery/],
];

const SOCIAL_PATTERNS: Array<[string, RegExp]> = [
  ["linkedin", /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[a-z0-9\-_%.]+/i],
  ["twitter", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-z0-9_]{1,30}/i],
  ["facebook", /https?:\/\/(?:www\.)?facebook\.com\/[a-z0-9.\-]+/i],
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9_.]+/i],
  ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[a-z0-9_\-]+/i],
];

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function detectTech(html: string, headers: Record<string, string>): string[] {
  const found = new Set<string>();
  const lower = html.toLowerCase();
  for (const [label, re] of TECH_HTML_SIGNATURES) {
    if (re.test(lower)) found.add(label);
  }
  const server = (headers["server"] || "").toLowerCase();
  const powered = (headers["x-powered-by"] || "").toLowerCase();
  if (headers["cf-ray"] || server.includes("cloudflare")) found.add("Cloudflare");
  if (server.includes("nginx")) found.add("Nginx");
  if (server.includes("apache")) found.add("Apache");
  if (powered.includes("express")) found.add("Express");
  if (powered.includes("php") || server.includes("php")) found.add("PHP");
  if (headers["x-vercel-id"] || server.includes("vercel")) found.add("Vercel");
  if (headers["x-nf-request-id"] || server.includes("netlify")) found.add("Netlify");
  // Next.js implies React; dedupe keeps one of each.
  if (found.has("Next.js")) found.add("React");
  return Array.from(found).sort();
}

function extractEmails(html: string, domain: string): string[] {
  const out = new Set<string>();
  const rootDomain = domain.split(".").slice(-2).join(".");
  const re = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
  const mailtos = html.match(/mailto:([^"'?>\s]+)/gi) || [];
  for (const m of mailtos) out.add(m.replace(/^mailto:/i, "").toLowerCase());
  const inline = html.match(re) || [];
  for (const e of inline) {
    const email = e.toLowerCase();
    // Keep same-root-domain emails; skip common asset/tracking noise.
    if (email.includes(rootDomain) && !/\.(png|jpg|jpeg|gif|svg|webp)$/.test(email)) out.add(email);
  }
  return Array.from(out)
    .filter((e) => !/sentry|wixpress|example\.|@sentry|\.wixpress/.test(e))
    .slice(0, 5);
}

/** Keyless on-page SEO snapshot derived from the already-fetched HTML. */
export function extractSeo(html: string, url: string): SeoSnapshot {
  const title = metaContent(html, [/<title[^>]*>([^<]+)<\/title>/i]);
  const metaDescription = metaContent(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ]);
  const h1s = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const firstH1 = h1s.length ? decodeEntities((h1s[0] || "").replace(/<[^>]+>/g, "").trim()).slice(0, 160) : null;
  const robotsMeta = (metaContent(html, [/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i]) || "").toLowerCase();
  const langMatch = html.match(/<html[^>]+lang=["']([a-z\-]+)["']/i);
  const ogCount = (html.match(/property=["']og:[a-z:]+["']/gi) || []).length;
  const jsonLdTypes = new Set<string>();
  const typeMatches = html.match(/"@type"\s*:\s*"([^"]+)"/gi) || [];
  for (const t of typeMatches.slice(0, 20)) {
    const m = t.match(/"@type"\s*:\s*"([^"]+)"/i);
    if (m) jsonLdTypes.add(m[1]);
  }
  // Rough word count from the visible body (scripts/styles/tags stripped).
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;

  return {
    title,
    titleLength: title ? title.length : 0,
    metaDescription,
    metaDescriptionLength: metaDescription ? metaDescription.length : 0,
    h1: firstH1,
    h1Count: h1s.length,
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(html),
    indexable: !robotsMeta.includes("noindex"),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    openGraphCount: ogCount,
    hasTwitterCard: /name=["']twitter:card["']/i.test(html),
    structuredDataTypes: Array.from(jsonLdTypes),
    lang: langMatch ? langMatch[1] : null,
    hasFavicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html),
    wordCount,
    https: url.startsWith("https"),
  };
}

/**
 * Keyless recent-news / funding signal via Google News' public RSS search.
 * Surfaces headlines (which often include funding/hiring/launch news). These are
 * HEADLINES, not verified funding amounts — no data-provider key involved.
 */
export async function fetchNews(query: string): Promise<NewsItem[]> {
  const q = (query || "").trim();
  if (!q) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent('"' + q + '"')}&hl=en-US&gl=US&ceid=US:en`,
      { signal: controller.signal, headers: { "User-Agent": UA } }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = (await res.text()).slice(0, 200_000);
    const items: NewsItem[] = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const b of blocks.slice(0, 5)) {
      const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const l = b.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const d = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (t && t[1]) items.push({ title: decodeEntities(t[1].trim()), link: l ? l[1].trim() : "", date: d ? d[1].trim() : null });
    }
    return items;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/**
 * Best-effort, keyless company-name → domain resolver via Clearbit's free public
 * autocomplete endpoint. Returns the top match's domain, or null (e.g. for small
 * companies it doesn't know). No API key required.
 */
export async function resolveCompanyDomain(name: string): Promise<string | null> {
  const q = (name || "").trim();
  if (!q) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const list = (await res.json()) as Array<{ domain?: string }>;
    if (Array.isArray(list) && list[0] && typeof list[0].domain === "string") return list[0].domain;
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Resolve context from either a domain or a company name. Prefers the domain;
 * falls back to resolving the name → domain. Returns the resolved source so the
 * caller can show "resolved from '<name>'".
 */
export async function getCompanyContextFor(params: {
  domain?: string;
  name?: string;
}): Promise<{ company: CompanyContext | null; resolvedFrom?: string }> {
  let domain = params.domain && normalizeDomain(params.domain) ? params.domain : null;
  let resolvedFrom: string | undefined;
  if (!domain && params.name) {
    const resolved = await resolveCompanyDomain(params.name);
    if (resolved) {
      domain = resolved;
      resolvedFrom = params.name;
    }
  }
  if (!domain) return { company: null };
  const company = await getCompanyContext(domain);
  return { company, resolvedFrom };
}

/** Fetch + parse a company's public site. Returns null on invalid input or fetch failure. */
export async function getCompanyContext(input: string): Promise<CompanyContext | null> {
  const norm = normalizeDomain(input);
  if (!norm) return null;
  const { domain, url } = norm;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
  clearTimeout(timer);
  if (!res.ok) return null;

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  let html = "";
  try {
    html = (await res.text()).slice(0, MAX_BYTES);
  } catch {
    return null;
  }

  const name =
    metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]) ||
    metaContent(html, [/<title[^>]*>([^<]+)<\/title>/i])?.split(/[|\-–—·:]/)[0].trim() ||
    null;

  const description = metaContent(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  let logo = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  ]);
  if (logo && logo.startsWith("/")) logo = `https://${domain}${logo}`;

  const socials: Record<string, string> = {};
  for (const [key, re] of SOCIAL_PATTERNS) {
    const m = html.match(re);
    if (m && !socials[key]) socials[key] = m[0];
  }

  const seo = extractSeo(html, url);
  const news = await fetchNews(name || domain);

  return {
    domain,
    url,
    name,
    description,
    logo,
    socials,
    emails: extractEmails(html, domain),
    tech: detectTech(html, headers),
    seo,
    news,
    fetchedAt: new Date().toISOString(),
  };
}
