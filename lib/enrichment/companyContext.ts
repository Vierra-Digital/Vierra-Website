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

// A notable executive/founder, with a link to their LinkedIn profile (direct
// when Wikidata has the handle, else a name search).
type KeyPerson = { name: string; role: string; url: string };

// Firmographics we can pull KEYLESSLY from the page's schema.org / JSON-LD.
// (Verified funding amounts + website traffic need a paid provider like Harmonic
// or SimilarWeb — not available without a key.)
type OrgProfile = {
  industry: string | null;
  employees: string | null;
  founded: string | null;
  location: string | null;
  revenue: string | null;
  ceo: string | null;
  people: KeyPerson[]; // key executives/founders with LinkedIn links
  source: string | null; // where the firmographics came from (e.g. "Wikidata", "schema.org")
};

// Global popularity rank from the Tranco research list (free, no key). Lower rank
// = more popular. `history` is oldest->newest daily ranks for a small trend chart.
type Popularity = {
  rank: number;
  previousRank: number | null; // ~30 days ago, for a trend delta
  history: { date: string; rank: number }[];
};

// Domain registration age — works for ANY domain (incl. tiny/new ones the
// popularity lists don't cover), via free keyless RDAP.
type DomainAge = { registered: string; ageYears: number };

// Open-roles snapshot from a company's public ATS board (Greenhouse/Lever/Ashby/
// Workable/Recruitee/SmartRecruiters). Free + keyless. A strong buying-intent
// signal: what they're hiring for = what they're investing in.
type Hiring = {
  ats: string; // which ATS the data came from
  count: number; // total open roles
  url: string | null; // public careers/board URL
  departments: { name: string; count: number }[]; // top hiring areas
  sample: { title: string; location: string }[]; // a few recent roles
};

// ROUGH monthly-visits estimate from a keyless third-party calculator
// (SiteWorthTraffic, derived from legacy Alexa-style rank models). No key needed,
// but low accuracy — always labelled "Est." in the UI. There is no free source
// for *measured* visit counts.
type Visits = { monthly: number; daily: number | null; source: string };

// Recent SEC filings — buying-intent events for US PUBLIC companies (keyless, needs
// a User-Agent header). 8-K item 5.02 = leadership change, 2.01 = M&A, etc.
type Filing = { form: string; date: string; label: string; url: string; intent: boolean };
type Financials = { cik: string; ticker: string | null; filings: Filing[] };

type CompanyContext = {
  domain: string;
  url: string;
  name: string | null;
  description: string | null;
  logo: string | null;
  socials: Record<string, string>;
  emails: string[];
  tech: string[];
  profile: OrgProfile;
  popularity: Popularity | null;
  domainAge: DomainAge | null;
  hiring: Hiring | null;
  visits: Visits | null;
  financials: Financials | null;
  fetchedAt: string;
};

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 600_000; // cap parsed HTML size
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Normalize arbitrary input (domain, url, "www.x.com/path") to a hostname + https URL. */
function normalizeDomain(input: string): { domain: string; url: string } | null {
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
  // Strip app/portal-style subdomains so app.slack.com -> slack.com (the marketing
  // site, which is faster to fetch and where firmographics/traffic actually live).
  let host = u.hostname;
  const appSub =
    /^(www|app|apps|my|portal|dashboard|login|signin|secure|mail|email|go|get|try|admin|account|accounts|help|support|docs?|blog|careers|jobs|status|api|m|web)\./;
  while (appSub.test(host) && host.split(".").length > 2) host = host.replace(appSub, "");
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

function detectTech(html: string, headers: Record<string, string>): string[] {
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


/** Keyless firmographics from schema.org / JSON-LD Organization blocks on the page. */
function extractOrgProfile(html: string): OrgProfile {
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
async function fetchWikidata(name: string, domain: string): Promise<Partial<OrgProfile> | null> {
  const query = (name || domain.split(".")[0] || "").trim();
  if (!query) return null;

  const getJson = async (url: string): Promise<any | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 3 sequential calls -> keep each tight
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

  // 3) Key people: CEO (P169), founder (P112), chairperson (P488), board members
  // (P3320), and directors/managers (P1037) — a broader leadership set than just
  // the CEO. Link each to LinkedIn via P6634 when present, else a name search.
  const people: KeyPerson[] = [];
  const itemUri = val(matched, "item");
  const qid = itemUri ? itemUri.split("/").pop() : null;
  if (qid && /^Q\d+$/.test(qid)) {
    const pq =
      `SELECT ?role ?personLabel ?linkedin WHERE {` +
      ` { wd:${qid} wdt:P169 ?person. BIND("CEO" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P112 ?person. BIND("Founder" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P488 ?person. BIND("Chair" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P1037 ?person. BIND("Director" AS ?role) }` +
      ` UNION { wd:${qid} wdt:P3320 ?person. BIND("Board member" AS ?role) }` +
      ` OPTIONAL { ?person wdt:P6634 ?linkedin. }` +
      ` SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 20`;
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

// Detect a company's ATS + board slug from already-fetched HTML (careers links are
// usually referenced somewhere on the site). Returns {ats, slug} or null.
function detectAts(html: string): { ats: string; slug: string } | null {
  const patterns: [string, RegExp][] = [
    ["greenhouse", /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i],
    ["greenhouse", /boards\.greenhouse\.io\/embed\/job_board\?for=([a-z0-9_-]+)/i],
    ["lever", /jobs\.lever\.co\/([a-z0-9_-]+)/i],
    ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i],
    ["workable", /(?:apply\.workable\.com\/|https?:\/\/)([a-z0-9_-]+)\.workable\.com/i],
    ["workable", /apply\.workable\.com\/([a-z0-9_-]+)/i],
    ["recruitee", /([a-z0-9_-]+)\.recruitee\.com/i],
    ["smartrecruiters", /careers\.smartrecruiters\.com\/([a-zA-Z0-9_-]+)/i],
  ];
  for (const [ats, re] of patterns) {
    const m = html.match(re);
    if (m && m[1] && !["www", "apply", "jobs", "boards", "careers"].includes(m[1].toLowerCase())) {
      return { ats, slug: m[1] };
    }
  }
  return null;
}

// Query a specific ATS board (keyless JSON) and normalize to a Hiring snapshot.
async function fetchAtsJobs(ats: string, slug: string): Promise<Hiring | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const get = async (url: string) => {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": UA } });
    return r.ok ? await r.json() : null;
  };
  try {
    let rows: Array<{ title: string; dept: string; loc: string }> = [];
    let url: string | null = null;
    if (ats === "greenhouse") {
      // /departments gives dept names + counts + jobs in one call (the /jobs
      // endpoint omits departments unless you fetch heavy content=true).
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/departments`);
      const depts = (d?.departments || []).filter((x: any) => x.jobs && x.jobs.length);
      rows = depts.flatMap((dep: any) =>
        dep.jobs.map((j: any) => ({ title: j.title || "", dept: dep.name || "", loc: j.location?.name || "" }))
      );
      url = `https://boards.greenhouse.io/${slug}`;
    } else if (ats === "lever") {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      rows = (Array.isArray(d) ? d : []).map((j: any) => ({ title: j.text || "", dept: j.categories?.department || j.categories?.team || "", loc: j.categories?.location || "" }));
      url = `https://jobs.lever.co/${slug}`;
    } else if (ats === "ashby") {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      rows = (d?.jobs || []).map((j: any) => ({ title: j.title || "", dept: j.department || j.team || "", loc: j.location || "" }));
      url = `https://jobs.ashbyhq.com/${slug}`;
    } else if (ats === "workable") {
      const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
      rows = (d?.jobs || []).map((j: any) => ({ title: j.title || "", dept: j.department || "", loc: j.city || j.country || "" }));
      url = `https://apply.workable.com/${slug}`;
    } else if (ats === "recruitee") {
      const d = await get(`https://${slug}.recruitee.com/api/offers/`);
      rows = (d?.offers || []).map((j: any) => ({ title: j.title || j.position || "", dept: j.department || "", loc: j.city || j.country || "" }));
      url = `https://${slug}.recruitee.com`;
    } else if (ats === "smartrecruiters") {
      const d = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
      rows = (d?.content || []).map((j: any) => ({ title: j.name || "", dept: j.department?.label || "", loc: j.location?.city || j.location?.country || "" }));
      url = `https://careers.smartrecruiters.com/${slug}`;
    }
    clearTimeout(timer);
    rows = rows.filter((r) => r.title);
    if (!rows.length) return null;
    const deptCounts: Record<string, number> = {};
    for (const r of rows) if (r.dept) deptCounts[r.dept] = (deptCounts[r.dept] || 0) + 1;
    const departments = Object.entries(deptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    return {
      ats,
      count: rows.length,
      url,
      departments,
      sample: rows.slice(0, 5).map((r) => ({ title: r.title, location: r.loc })),
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Hiring signal: detect the ATS from the site HTML; if not found, probe the top
// three ATSes with a normalized slug guess. All keyless.
async function fetchHiring(domain: string, html: string): Promise<Hiring | null> {
  const detected = detectAts(html);
  if (detected) {
    const h = await fetchAtsJobs(detected.ats, detected.slug);
    if (h) return h;
  }
  const guess = domain.split(".")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!guess) return null;
  const probes = await Promise.all([
    fetchAtsJobs("greenhouse", guess),
    fetchAtsJobs("lever", guess),
    fetchAtsJobs("ashby", guess),
  ]);
  return probes.find(Boolean) || null;
}

/**
 * ROUGH monthly-visits estimate via SiteWorthTraffic (keyless HTML). These are
 * legacy-Alexa-derived approximations, NOT measured traffic — surfaced only
 * because no free source for real visit counts exists. Always shown as "Est.".
 */
async function fetchVisits(domain: string): Promise<Visits | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://www.siteworthtraffic.com/report/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 150_000);
    const visitorsIn = (section: string): number | null => {
      const chunk = html.split(new RegExp(`${section} ESTIMATIONS`, "i"))[1] || "";
      const m = chunk.match(/Unique Visitors<\/td>\s*<td>([0-9,]+)/i);
      return m ? Number(m[1].replace(/,/g, "")) : null;
    };
    const monthly = visitorsIn("MONTHLY");
    if (!monthly || monthly <= 0) return null;
    return { monthly, daily: visitorsIn("DAILY"), source: "SiteWorthTraffic" };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// SEC ticker->CIK map (public companies only), cached in-module.
let secTickers: { title: string; cik: string; ticker: string }[] | null = null;
async function getSecTickers(): Promise<typeof secTickers> {
  if (secTickers) return secTickers;
  try {
    const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    secTickers = Object.values(j).map((v) => ({ title: String(v.title || ""), cik: String(v.cik_str), ticker: String(v.ticker || "") }));
    return secTickers;
  } catch {
    return null;
  }
}
function normCompany(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(inc|corp|corporation|company|co|ltd|limited|llc|plc|holdings|group|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recent SEC filings for US PUBLIC companies (keyless; UA header required). Surfaces
 * buying-intent events: 8-K item 5.02 (leadership change), 2.01 (M&A), etc. Matches
 * by company name; returns null for private/non-US/no-match to avoid wrong data.
 */
async function fetchFilings(name: string): Promise<Financials | null> {
  const q = normCompany(name || "");
  if (!q || q.length < 3) return null;
  const list = await getSecTickers();
  if (!list) return null;
  const hit = list.find((t) => normCompany(t.title) === q) || list.find((t) => normCompany(t.title).startsWith(q + " "));
  if (!hit) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const padded = hit.cik.padStart(10, "0");
    const r = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = (await r.json()) as any;
    const rec = j?.filings?.recent;
    if (!rec || !Array.isArray(rec.form)) return null;
    const ITEMS: Record<string, string> = {
      "5.02": "Leadership change",
      "2.01": "Completed acquisition",
      "1.01": "Material agreement",
      "1.05": "Cybersecurity incident",
      "2.02": "Earnings released",
      "5.07": "Shareholder vote",
      "8.01": "Company event",
    };
    const INTENT = new Set(["5.02", "2.01", "1.01"]);
    const filings: Filing[] = [];
    for (let i = 0; i < rec.form.length && filings.length < 5; i++) {
      const form = String(rec.form[i] || "");
      if (!(form === "8-K" || form === "10-K" || form === "S-1" || form.startsWith("424"))) continue;
      let label = form;
      let intent = false;
      if (form === "8-K") {
        const items = String(rec.items[i] || "").split(",").map((s) => s.trim());
        label = items.map((it) => ITEMS[it]).filter(Boolean)[0] || "Company event (8-K)";
        intent = items.some((it) => INTENT.has(it));
      } else if (form === "10-K") label = "Annual report (10-K)";
      else if (form === "S-1") { label = "IPO registration (S-1)"; intent = true; }
      else if (form.startsWith("424")) label = "Prospectus";
      const acc = String(rec.accessionNumber[i] || "").replace(/-/g, "");
      const doc = String(rec.primaryDocument[i] || "");
      const url = acc && doc ? `https://www.sec.gov/Archives/edgar/data/${Number(hit.cik)}/${acc}/${doc}` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}`;
      filings.push({ form, date: String(rec.filingDate[i] || ""), label, url, intent });
    }
    if (!filings.length) return null;
    return { cik: hit.cik, ticker: hit.ticker || null, filings };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Global popularity rank from the Tranco list (free, no key, research-grade).
 * Works server-side (no bot-blocking, unlike SimilarWeb). Returns the latest rank
 * + a ~30-day history for a trend, or null when the domain isn't in the top ~1M.
 */
async function fetchTranco(domain: string): Promise<Popularity | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { ranks?: Array<{ date: string; rank: number }> };
    const ranks = Array.isArray(data.ranks) ? data.ranks.filter((r) => r && typeof r.rank === "number") : [];
    if (!ranks.length) return null;
    // The API returns newest-first; make history oldest->newest, capped at 30 points.
    const history = ranks.slice(0, 30).reverse().map((r) => ({ date: r.date, rank: r.rank }));
    const rank = history[history.length - 1].rank;
    const previousRank = history.length > 1 ? history[0].rank : null;
    return { rank, previousRank, history };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// IANA RDAP bootstrap (tld -> registry RDAP base), cached in-module. Hitting the
// registry directly is fast (~0.2-0.5s); the rdap.org redirector is not (30s+).
let rdapBootstrap: Record<string, string> | null = null;
async function getRdapBase(tld: string): Promise<string | null> {
  if (!rdapBootstrap) {
    try {
      const res = await fetch("https://data.iana.org/rdap/dns.json", { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const j = (await res.json()) as { services: [string[], string[]][] };
      const map: Record<string, string> = {};
      for (const [tlds, urls] of j.services) {
        const base = (urls[0] || "").replace(/\/$/, "");
        for (const t of tlds) map[t] = base;
      }
      rdapBootstrap = map;
    } catch {
      return null;
    }
  }
  return rdapBootstrap[tld] || null;
}

/**
 * Domain registration age via keyless RDAP — works for ANY domain, including
 * tiny/new sites the popularity lists don't cover. A useful "how established is
 * this company" signal for small prospects.
 */
async function fetchDomainAge(domain: string): Promise<DomainAge | null> {
  const tld = domain.split(".").pop();
  if (!tld) return null;
  const base = await getRdapBase(tld);
  const url = base ? `${base}/domain/${encodeURIComponent(domain)}` : `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as { events?: Array<{ eventAction: string; eventDate: string }> };
    const reg = (j.events || []).find((e) => e.eventAction === "registration");
    if (!reg || !reg.eventDate) return null;
    const ms = Date.now() - new Date(reg.eventDate).getTime();
    if (!(ms >= 0)) return null;
    return { registered: reg.eventDate.slice(0, 10), ageYears: Math.round((ms / (365.25 * 864e5)) * 10) / 10 };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Best-effort, keyless company-name → domain resolver via Clearbit's free public
 * autocomplete endpoint. Returns the top match's domain, or null (e.g. for small
 * companies it doesn't know). No API key required.
 */
async function resolveCompanyDomain(name: string): Promise<string | null> {
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
async function getCompanyContext(input: string): Promise<CompanyContext | null> {
  const norm = normalizeDomain(input);
  if (!norm) return null;
  const { domain, url } = norm;

  // These enrichments only need the domain, not the page HTML — kick them off now
  // so they overlap the (slower) site fetch + Wikidata below instead of adding to
  // it. Each resolves to null on failure, so awaiting later never rejects.
  const trancoP = fetchTranco(domain);
  const domainAgeP = fetchDomainAge(domain);
  const visitsP = fetchVisits(domain);

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

  // Prefer the actual brand mark (apple-touch-icon / og:logo / favicon) over
  // og:image, which is usually a social-share BANNER, not the logo.
  let logo = metaContent(html, [
    /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["']/i,
    /<meta[^>]+property=["']og:logo["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  ]);
  if (logo) {
    if (logo.startsWith("//")) logo = "https:" + logo;
    else if (logo.startsWith("/")) logo = `https://${domain}${logo}`;
  }

  const socials: Record<string, string> = {};
  for (const [key, re] of SOCIAL_PATTERNS) {
    const m = html.match(re);
    if (m && !socials[key]) socials[key] = m[0];
  }

  const profile = extractOrgProfile(html);
  // Wikidata + hiring both need the fetched page (name / ATS links); run together.
  // The other three were started above and are (mostly) already done by now.
  const [wd, hiring, financials, popularity, domainAge, visits] = await Promise.all([
    fetchWikidata(name || "", domain),
    fetchHiring(domain, html),
    fetchFilings(name || domain.split(".")[0]),
    trancoP,
    domainAgeP,
    visitsP,
  ]);
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
    profile,
    popularity,
    domainAge,
    hiring,
    visits,
    financials,
    fetchedAt: new Date().toISOString(),
  };
}
