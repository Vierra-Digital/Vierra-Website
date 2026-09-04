import { escapeHtml } from "@/lib/utils";

/**
 * Click tracking: which URLs get a token, and how they are swapped into the outgoing HTML.
 *
 * These two halves have to agree. mergeClickTrackUrls decides what gets a tracking token and a
 * database row; rewriteTrackedLinksInHtml is what actually replaces the URL in the mail that goes
 * out. A URL the first extracts and the second cannot rewrite becomes an orphan token: a row
 * pointing at a link that ships untracked, and a tracking report that under-counts without saying
 * so. The two patterns are therefore kept adjacent in this file rather than 40 lines apart in the
 * 600-line send path they were extracted from, and tests/sendCoreLinks.test.ts holds them
 * together.
 *
 * Both send paths share this — lib/gmail/sendCore for a single send and lib/campaigns/
 * sendQueueTick for a campaign step — so a divergence would affect both.
 */
export function rewriteTrackedLinksInHtml(value: string, replacements: Map<string, string>) {
  if (!value || replacements.size === 0) return value;
  return value.replace(/href=(['"])(https?:\/\/[^\s"'<>]+)\1/gi, (match, quote: string, href: string) => {
    const trackedHref = replacements.get(href);
    if (!trackedHref) return match;
    return `href=${quote}${escapeHtml(trackedHref)}${quote}`;
  });
}

export function linkifyTextWithTrackedHrefs(value: string, replacements: Map<string, string>) {
  if (!value) return "";
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const chunks: string[] = [];
  let lastIndex = 0;
  let match = urlRegex.exec(value);
  while (match) {
    const rawUrl = match[0];
    const start = match.index;
    if (start > lastIndex) {
      chunks.push(escapeHtml(value.slice(lastIndex, start)).replace(/\n/g, "<br>"));
    }
    const href = replacements.get(rawUrl) || rawUrl;
    chunks.push(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">${escapeHtml(rawUrl)}</a>`
    );
    lastIndex = start + rawUrl.length;
    match = urlRegex.exec(value);
  }
  if (lastIndex < value.length) {
    chunks.push(escapeHtml(value.slice(lastIndex)).replace(/\n/g, "<br>"));
  }
  return chunks.join("");
}

function uniqueUrls(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"']+/g) || [];
  return Array.from(new Set(matches));
}

function uniqueUrlsFromHtmlHref(html: string) {
  const set = new Set<string>();
  // MUST match rewriteTrackedLinksInHtml's pattern exactly, or a URL gets a tracking token +
  // DB row here but is never rewritten in the sent HTML (orphan token, untracked link).
  const re = /href=(["'])(https?:\/\/[^\s"'<>]+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    set.add(m[2]);
  }
  return Array.from(set);
}

export function mergeClickTrackUrls(plain: string, html: string) {
  return Array.from(new Set([...uniqueUrls(plain), ...uniqueUrlsFromHtmlHref(html)]));
}
