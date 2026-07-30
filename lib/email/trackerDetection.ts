/**
 * Email open-tracker detection for inbound HTML.
 *
 * Every open-tracker is a remote image whose load pings a vendor server with a per-recipient
 * token. Detection therefore = inspecting every remote image reference. Two things defeat a
 * naive domain list, so we combine a vendor list with vendor-agnostic heuristics:
 *   - Cold-outreach tools increasingly serve the pixel from a custom CNAME on the SENDER's own
 *     subdomain (track.senderco.com → CNAME → the vendor), so the vendor host never appears.
 *   - Gmail proxies remote images via *.googleusercontent.com; we decode to the inner target.
 *
 * scoreTrackerImage() returns a score + confidence + (best-effort) vendor name. Threshold:
 * score >= 5 → high, 3–4 → medium, < 3 → not flagged. A vendor/recipient hit alone is enough;
 * otherwise it takes two independent medium signals, and known CDNs are dampened so logos/hero
 * images and spacer gifs don't get flagged.
 */

/** Vendor URL/host signatures — matched as case-insensitive substrings of the full URL. */
export const TRACKER_PATTERNS: { pattern: string; vendor: string }[] = [
  // Mailtrack / Mailsuite
  { pattern: "mailtrack.io", vendor: "Mailtrack" },
  { pattern: "mltrk.io/pixel", vendor: "Mailtrack" },
  // Yesware
  { pattern: "t.yesware.com", vendor: "Yesware" },
  { pattern: "app.yesware.com", vendor: "Yesware" },
  // HubSpot (Sales / Sidekick)
  { pattern: "sidekickopen", vendor: "HubSpot" },
  { pattern: "track.getsidekick.com", vendor: "HubSpot" },
  { pattern: "t.signaux", vendor: "HubSpot" },
  { pattern: "t.senal", vendor: "HubSpot" },
  { pattern: "t.sigopn", vendor: "HubSpot" },
  { pattern: "t.hsms06.com", vendor: "HubSpot" },
  { pattern: "t.hubspotemail.net", vendor: "HubSpot" },
  { pattern: "hubspotlinks.com", vendor: "HubSpot" },
  // Mixmax
  { pattern: "track.mixmax.com", vendor: "Mixmax" },
  { pattern: "email.mixmax.com", vendor: "Mixmax" },
  // Streak
  { pattern: "mailfoogae.appspot.com", vendor: "Streak" },
  // Outreach
  { pattern: "app.outreach.io", vendor: "Outreach" },
  { pattern: "outrch.com/api/mailings/opened", vendor: "Outreach" },
  // Salesloft
  { pattern: "slft.co", vendor: "Salesloft" },
  { pattern: "salesloft.com", vendor: "Salesloft" },
  // Cirrus Insight / Bananatag
  { pattern: "tracking.cirrusinsight.com", vendor: "Cirrus Insight" },
  { pattern: "bl-1.com", vendor: "Bananatag" },
  // Superhuman
  { pattern: "r.superhuman.com", vendor: "Superhuman" },
  // GMass
  { pattern: "track.gmass.co", vendor: "GMass" },
  { pattern: "x.gmtrack.net", vendor: "GMass" },
  // Smartlead / Apollo / Saleshandy
  { pattern: "track.smartlead.ai", vendor: "Smartlead" },
  { pattern: "go.apollo.io", vendor: "Apollo" },
  { pattern: "saleshandy.com", vendor: "Saleshandy" },
  // ContactMonkey / ToutApp / Close / Polymail
  { pattern: "contactmonkey.com/api/v1/tracker", vendor: "ContactMonkey" },
  { pattern: "toutapp.com", vendor: "ToutApp" },
  { pattern: "close.io/email_opened", vendor: "Close" },
  { pattern: "polymail.io/v2/z", vendor: "Polymail" },
  // Intercom / Front / Boomerang
  { pattern: "via.intercom.io/o", vendor: "Intercom" },
  { pattern: "intercom-mail", vendor: "Intercom" },
  { pattern: "web.frontapp.com/api", vendor: "Front" },
  { pattern: "mailstat.us/tr", vendor: "Boomerang" },
  // NetHunt / ReBump / RelateIQ / generic
  { pattern: "nethunt.com/api/v1/track/email", vendor: "NetHunt" },
  { pattern: "rebump.cc/api/track", vendor: "ReBump" },
  { pattern: "app.relateiq.com/t.png", vendor: "RelateIQ" },
  { pattern: "emltrk.com", vendor: "EmailTracker" },
  // Bulk ESP / marketing (still "tracking", lower priority)
  { pattern: "list-manage.com/track", vendor: "Mailchimp" },
  { pattern: "ct.sendgrid.net", vendor: "SendGrid" },
  { pattern: "sendgrid.net/wf/open", vendor: "SendGrid" },
  { pattern: "awstrack.me", vendor: "Amazon SES" },
  { pattern: "mandrillapp.com/track", vendor: "Mandrill" },
  { pattern: "pstmrk.it/open", vendor: "Postmark" },
  { pattern: "click.icptrack.com/icp", vendor: "iContact" },
  { pattern: "infusionsoft.com/app/emailopened", vendor: "Infusionsoft" },
  { pattern: "api.mixpanel.com/track", vendor: "Mixpanel" },
  { pattern: "open.convertkit", vendor: "ConvertKit" },
  { pattern: "substack.com/o", vendor: "Substack" },
  { pattern: "yamm-track.appspot", vendor: "YAMM" },
  { pattern: "cmail1.com/t", vendor: "Campaign Monitor" },
  { pattern: "sparkpostmail", vendor: "SparkPost" },
  { pattern: "mailgun", vendor: "Mailgun" },
  { pattern: "sendinblue", vendor: "Brevo/Sendinblue" },
  { pattern: "getresponse", vendor: "GetResponse" },
  { pattern: "constantcontact", vendor: "Constant Contact" },
];

/** Vendor-agnostic open-tracking path/param fragments (pair with remoteness/tiny/hidden). */
export const GENERIC_OPEN_FRAGMENTS: string[] = [
  "/wf/open", "/track/open", "/track/open.php", "/open.php", "/ut.php",
  "/o.gif", "/trk", "/beacon", "/pixel.gif", "/pixel.png", "/open.gif",
  "?recipient=", "&recipient=", "?email=", "&email=", "?campaignid=",
  "?mid=", "?uid=", "/e/o/", "/eo/", "/oo/",
];

/** Tracking-style subdomain prefixes (boost signal, never flag alone). */
export const TRACKING_SUBDOMAINS: string[] = [
  "track.", "tracking.", "email.", "e.", "click.", "clicks.", "link.",
  "links.", "mail.", "open.", "opens.", "px.", "pixel.", "beacon.", "t.",
];

/** CDN / proxy hosts that dampen heuristic-only hits (still checked against TRACKER_PATTERNS). */
export const KNOWN_CDN_HOSTS: string[] = [
  "cloudfront.net", "akamaihd.net", "fastly.net", "imgix.net",
  "cdn.shopify.com", "gstatic.com", "cloudflare.com", "wp.com",
  "gravatar.com", "s3.amazonaws.com", "ytimg.com",
];

export type TrackerVerdict = {
  tracked: boolean;
  vendor: string | null;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
};

function hostnameOf(url: string): string {
  try {
    return new URL(url, "https://_").hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Unwrap a Gmail image-proxy URL (*.googleusercontent.com/...#<original>) to the inner target. */
export function decodeProxiedUrl(raw: string): string {
  const host = hostnameOf(raw);
  if (!/googleusercontent\.com$/.test(host)) return raw;
  // Classic proxy form embeds the original after a '#'.
  const hashIndex = raw.indexOf("#");
  if (hashIndex >= 0) {
    const frag = raw.slice(hashIndex + 1);
    if (/^https?:\/\//i.test(frag)) {
      try {
        return decodeURIComponent(frag);
      } catch {
        return frag;
      }
    }
  }
  // Fallback: an encoded http(s) URL embedded in the path.
  const enc = raw.match(/https?(?::|%3a)(?:\/\/|%2f%2f)[^#\s]+/i);
  if (enc) {
    try {
      return decodeURIComponent(enc[0]);
    } catch {
      return enc[0];
    }
  }
  return raw;
}

function hasHighEntropyToken(url: string): boolean {
  // A long opaque token (>=16 chars, mixed letters+digits) in the path/query — the per-recipient id.
  const segments = url.split(/[/?&=#._-]/);
  return segments.some(
    (s) => s.length >= 16 && /^[A-Za-z0-9+/=]+$/.test(s) && /[0-9]/.test(s) && /[A-Za-z]/.test(s)
  );
}

/**
 * Score a single image reference. `senderDomain` is optional — when provided, images on the
 * sender's own domain are treated as less suspicious.
 */
export function scoreTrackerImage(input: {
  src: string;
  width?: string | null;
  height?: string | null;
  style?: string | null;
  alt?: string | null;
  senderDomain?: string;
}): TrackerVerdict {
  const rawSrc = (input.src || "").trim();
  const reasons: string[] = [];
  if (!rawSrc) return { tracked: false, vendor: null, confidence: "low", score: 0, reasons };
  const lowerScheme = rawSrc.slice(0, 5).toLowerCase();
  if (lowerScheme.startsWith("cid:") || lowerScheme.startsWith("data:")) {
    return { tracked: false, vendor: null, confidence: "low", score: 0, reasons };
  }

  const src = decodeProxiedUrl(rawSrc);
  const url = src.toLowerCase();
  const host = hostnameOf(src);
  const style = (input.style || "").toLowerCase();
  let score = 0;
  let vendor: string | null = null;

  // H1 — vendor pattern (strongest).
  for (const entry of TRACKER_PATTERNS) {
    if (url.includes(entry.pattern)) {
      score += 5;
      vendor = entry.vendor;
      reasons.push(`vendor:${entry.vendor}`);
      break;
    }
  }

  // H2 — generic open-tracking path/param fragment.
  if (GENERIC_OPEN_FRAGMENTS.some((f) => url.includes(f))) {
    score += 3;
    reasons.push("open-path");
  }

  // H3 — declared 1x1 / 0 dimensions (attrs or inline style).
  const w = (input.width || "").trim();
  const h = (input.height || "").trim();
  const attrTiny = (w === "0" || w === "1") && (h === "0" || h === "1");
  const styleTiny = /width\s*:\s*[01]px/.test(style) && /height\s*:\s*[01]px/.test(style);
  if (attrTiny || styleTiny) {
    score += 3;
    reasons.push("tiny");
  }

  // H4 — hidden / off-screen.
  if (/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|left\s*:\s*-\d{3,}px/.test(style)) {
    score += 2;
    reasons.push("hidden");
  }

  // Remoteness + entropy + tracking subdomain.
  const isCdn = KNOWN_CDN_HOSTS.some((c) => host === c || host.endsWith(`.${c}`));
  const senderDomain = (input.senderDomain || "").toLowerCase();
  const onSenderDomain = Boolean(senderDomain) && (host === senderDomain || host.endsWith(`.${senderDomain}`));
  const isRemote = Boolean(host) && !isCdn && !onSenderDomain;
  if (isRemote) {
    score += 1;
    reasons.push("third-party");
    if (hasHighEntropyToken(src)) {
      score += 2;
      reasons.push("random-token");
    }
    if (TRACKING_SUBDOMAINS.some((s) => host.startsWith(s))) {
      score += 1;
      reasons.push("tracking-subdomain");
    }
    const altEmpty = !(input.alt || "").trim();
    if (altEmpty && (attrTiny || styleTiny || !w)) {
      score += 1;
      reasons.push("no-alt");
    }
  }

  // Known CDN with no vendor hit → almost certainly a logo/hero/spacer, not a beacon.
  if (isCdn && !vendor) {
    return { tracked: false, vendor: null, confidence: "low", score: 0, reasons: ["cdn"] };
  }

  const confidence: TrackerVerdict["confidence"] = score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { tracked: score >= 3, vendor, confidence, score, reasons };
}
