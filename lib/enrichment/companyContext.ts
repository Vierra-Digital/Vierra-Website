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

// A notable executive/founder, with a link to their LinkedIn profile (direct
// when Wikidata has the handle, else a name search).
export type KeyPerson = { name: string; role: string; url: string };

// Firmographics we can pull KEYLESSLY from the page's schema.org / JSON-LD.
// (Verified funding amounts + website traffic need a paid provider like Harmonic
// or SimilarWeb — not available without a key.)
export type OrgProfile = {
  industry: string | null;
  employees: string | null;
  founded: string | null;
  location: string | null;
  revenue: string | null;
  ceo: string | null;
  people: KeyPerson[]; // key executives/founders with LinkedIn links
  source: string | null; // where the firmographics came from (e.g. "Wikidata", "schema.org")
};

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
  profile: OrgProfile;
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

/** Keyless firmographics from schema.org / JSON-LD Organization blocks on the page. */
export function extractOrgProfile(html: string): OrgProfile {
  const out: OrgProfile = { industry: null, employees: null, founded: null, location: null, revenue: null, ceo: null, people: [], source: null };
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const nodes: Record<string, unknown>[] = [];
  const collect = (d: unknown) => {
    if (!d) return;
    if (Array.isArray(d)) d.forEach(collect);
    else if (typeof d === "object") {
      const o = d as Record<string, unknown>;
      nodes.push(o);
      if (o["@graph"]) collect(o["@graph"]);
    }
  };
  for (const b of blocks.slice(0, 8)) {
    const jsonText = b.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    try {
      collect(JSON.parse(jsonText));
    } catch {
      /* malformed JSON-LD — skip */
    }
  }
  for (const n of nodes) {
    const type = n["@type"];
    const types = Array.isArray(type) ? type : [type];
    const isOrg = types.some((t) => typeof t === "string" && /Organization|Corporation|LocalBusiness|Company/i.test(t));
    if (!isOrg) continue;
    if (!out.employees && n.numberOfEmployees != null) {
      const ne = n.numberOfEmployees as { value?: unknown; minValue?: unknown } | number | string;
      const v = typeof ne === "object" ? ne.value ?? ne.minValue : ne;
      if (v != null && String(v).trim()) out.employees = String(v).trim();
    }
    if (!out.founded && n.foundingDate) out.founded = String(n.foundingDate).slice(0, 4);
    if (!out.industry && (n.industry || n.naics)) out.industry = String(n.industry || n.naics).slice(0, 80);
    if (!out.location && n.address) {
      const a = n.address as Record<string, unknown> | string;
      if (typeof a === "string") out.location = a.slice(0, 120);
      else if (a && typeof a === "object") {
        const loc = [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
        if (loc) out.location = loc.slice(0, 120);
      }
    }
  }
  if (out.industry || out.employees || out.founded || out.location || out.revenue) out.source = "schema.org";
  return out;
}

/**
 * Keyless firmographics from WIKIDATA (free, no API key): employees, founding
 * year, industry, HQ, and revenue — for notable companies. Matches by company
 * name, then prefers the entity whose official website matches the domain.
 */
export async function fetchWikidata(name: string, domain: string): Promise<Partial<OrgProfile> | null> {
  const query = (name || domain.split(".")[0] || "").trim();
  if (!query) return null;

  const getJson = async (url: string): Promise<any | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA, Accept: "application/json" } });
      clearTimeout(timer);
      return res.ok ? await res.json() : null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  // 1) Find candidate entities by name.
  const search = await getJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=item&format=json&limit=5`
  );
  const ids: string[] = Array.isArray(search?.search) ? search.search.map((s: any) => s.id).filter(Boolean).slice(0, 5) : [];
  if (!ids.length) return null;

  // 2) Pull firmographics for those candidates in one SPARQL call (labels resolved).
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const sparql =
    `SELECT ?item ?website ?employees ?inception ?industryLabel ?hqLabel ?revenue ?ceoLabel WHERE {` +
    ` VALUES ?item { ${values} }` +
    ` OPTIONAL { ?item wdt:P856 ?website }` +
    ` OPTIONAL { ?item wdt:P1128 ?employees }` +
    ` OPTIONAL { ?item wdt:P571 ?inception }` +
    ` OPTIONAL { ?item wdt:P452 ?industry }` +
    ` OPTIONAL { ?item wdt:P159 ?hq }` +
    ` OPTIONAL { ?item wdt:P2139 ?revenue }` +
    ` OPTIONAL { ?item wdt:P169 ?ceo }` +
    ` SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const data = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`);
  const rows: any[] = data?.results?.bindings || [];
  if (!rows.length) return null;

  const root = domain.split(".").slice(-2).join(".");
  const val = (r: any, k: string) => (r[k] && r[k].value ? String(r[k].value) : null);
  // Prefer the row whose official website matches the domain; else the first with data.
  const matched =
    (root && rows.find((r) => val(r, "website") && val(r, "website")!.toLowerCase().includes(root))) ||
    rows.find((r) => val(r, "employees") || val(r, "industryLabel") || val(r, "revenue") || val(r, "ceoLabel")) ||
    rows[0];
  if (!matched) return null;

  const employees = val(matched, "employees");
  const inception = val(matched, "inception");
  const revenue = val(matched, "revenue");
  const industry = val(matched, "industryLabel");
  const hq = val(matched, "hqLabel");
  const ceo = val(matched, "ceoLabel");

  // 3) Key executives: CEO (P169), founder (P112), chairperson (P488). Link each
  // to their LinkedIn profile via P6634 when Wikidata has it, else a name search.
  const people: KeyPerson[] = [];
  const itemUri = val(matched, "item");
  const qid = itemUri ? itemUri.split("/").pop() : null;
  if (qid && /^Q\d+$/.test(qid)) {
    const pq =
      `SELECT ?role ?personLabel ?linkedin WHERE {` +
      ` { wd:${qid} wdt:P169 ?person. BIND("CEO" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P112 ?person. BIND("Founder" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P488 ?person. BIND("Chair" AS ?role) }` +
      ` OPTIONAL { ?person wdt:P6634 ?linkedin. }` +
      ` SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 12`;
    const pdata = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(pq)}`);
    const prows: any[] = pdata?.results?.bindings || [];
    const seen = new Set<string>();
    for (const r of prows) {
      const nlabel = val(r, "personLabel");
      if (!nlabel || /^Q\d+$/.test(nlabel) || seen.has(nlabel)) continue;
      seen.add(nlabel);
      const li = val(r, "linkedin");
      people.push({
        name: nlabel,
        role: val(r, "role") || "",
        url: li
          ? `https://www.linkedin.com/in/${li}`
          : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(nlabel)}`,
      });
    }
  }

  if (!employees && !inception && !revenue && !industry && !hq && !ceo && !people.length) return null;

  return {
    industry: industry,
    employees: employees ? Number(employees).toLocaleString() : null,
    founded: inception ? inception.slice(0, 4) : null,
    location: hq,
    revenue: revenue ? "$" + Number(revenue).toLocaleString() : null,
    ceo: ceo,
    people,
    source: "Wikidata",
  };
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
  const profile = extractOrgProfile(html);
  // Fill gaps from Wikidata (free, no key) — great for notable companies.
  const wd = await fetchWikidata(name || "", domain);
  if (wd) {
    profile.industry = profile.industry || wd.industry || null;
    profile.employees = profile.employees || wd.employees || null;
    profile.founded = profile.founded || wd.founded || null;
    profile.location = profile.location || wd.location || null;
    profile.revenue = profile.revenue || wd.revenue || null;
    profile.ceo = profile.ceo || wd.ceo || null;
    if (wd.people && wd.people.length) profile.people = wd.people;
    if (!profile.source && (wd.industry || wd.employees || wd.founded || wd.location || wd.revenue || wd.ceo)) profile.source = "Wikidata";
    else if (profile.source && wd.source && (wd.industry || wd.employees)) profile.source = "schema.org + Wikidata";
  }

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
    profile,
    fetchedAt: new Date().toISOString(),
  };
}
