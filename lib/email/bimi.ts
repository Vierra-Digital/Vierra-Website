import { promises as dns } from "dns";

/**
 * BIMI — the sender's own published logo.
 *
 * A brand publishes a logo at `default._bimi.<domain>` in DNS, and mailbox providers show it as the
 * verified sender avatar. It is the only source here that comes from the sender rather than being
 * guessed at, so it takes priority over Gravatar and favicons.
 *
 * It also solves the case favicons cannot: bulk senders mail from a subdomain like email.apple.com,
 * which has no favicon of its own, but does carry a BIMI record pointing at Apple's logo.
 */

/** A logo URL is only usable if it is an https SVG, which the BIMI spec requires. */
function isUsableLogoUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    return new URL(value).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}

/**
 * Pull the logo URL out of a BIMI TXT record.
 *
 * Records look like `v=BIMI1; l=https://…/logo.svg; a=https://…/cert.pem`. The `a=` value is the
 * certificate that vouches for the logo, never the image, so only `l=` is read.
 */
export function parseBimiRecord(record: string): string {
  if (!/^\s*v\s*=\s*BIMI1\b/i.test(record)) return "";
  for (const part of record.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey.trim().toLowerCase() !== "l") continue;
    // Rejoin: the value is a URL and contains its own "=" in query strings.
    const value = rest.join("=").trim();
    if (isUsableLogoUrl(value)) return value;
  }
  return "";
}

/**
 * Multi-label public suffixes, so a root domain is derived as company.co.uk rather than the
 * meaningless co.uk. Not exhaustive — the common ones, with a two-label default.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "co.za", "co.jp", "or.jp", "ne.jp",
  "com.br", "com.mx", "com.ar", "com.sg", "com.hk", "com.tr", "com.cn", "com.tw",
]);

/** The registrable domain: email.apple.com -> apple.com, mail.company.co.uk -> company.co.uk. */
export function rootDomain(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return MULTI_LABEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** Domains to try, most specific first: the sending subdomain, then its registrable root. */
export function bimiLookupDomains(domain: string): string[] {
  if (!domain) return [];
  const root = rootDomain(domain);
  return root && root !== domain ? [domain, root] : [domain];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Misses expire sooner, so a brand that publishes a record later is picked up without a restart. */
const MISS_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * The sender domain's BIMI logo URL, or "" when it publishes none.
 *
 * DNS failures are indistinguishable from "no record" for our purposes and are treated the same. The
 * lookup is cached because a mailbox sees the same handful of sending domains over and over.
 */
export async function resolveBimiLogoUrl(
  domain: string,
  now: number = Date.now(),
  resolveTxt: (hostname: string) => Promise<string[][]> = dns.resolveTxt
): Promise<string> {
  if (!domain) return "";
  const cached = cache.get(domain);
  if (cached && cached.expiresAt > now) return cached.url;

  let found = "";
  for (const candidate of bimiLookupDomains(domain)) {
    try {
      const records = await resolveTxt(`default._bimi.${candidate}`);
      // A TXT record arrives as chunks that must be concatenated before parsing.
      for (const chunks of records) {
        const url = parseBimiRecord(chunks.join(""));
        if (url) {
          found = url;
          break;
        }
      }
    } catch {
      // NXDOMAIN, no data, timeout: this domain publishes nothing we can use.
    }
    if (found) break;
  }

  cache.set(domain, { url: found, expiresAt: now + (found ? CACHE_TTL_MS : MISS_TTL_MS) });
  return found;
}

/** Testing seam. */
export function clearBimiCache(): void {
  cache.clear();
}
