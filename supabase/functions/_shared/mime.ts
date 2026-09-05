import { base64ToBytes, bytesToBase64 } from "./crypto.ts";

/**
 * Deno port of the pure string/MIME-building half of lib/gmail/sendCore.ts, plus the two
 * Buffer-based helpers from lib/gmail/gmailApi.ts it depends on (toBase64Url) and
 * lib/api/parsing.ts (asStr). All logic here is copied verbatim from those files except where a
 * Node builtin needed a Web-API/Deno equivalent:
 *   - `randomUUID` (Node's `crypto` module) -> the global `crypto.randomUUID()`, native in Deno.
 *   - `Buffer` (base64 encode/decode) -> the byte helpers already in ./crypto.ts.
 */

export function asStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** Extract the bare address from a `Name <addr>` header value. Lowercases unless `lower:false`. */
export function parseAddressFromHeader(value: string, opts?: { lower?: boolean }): string {
  const trimmed = (value || "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const addr = angle?.[1] ? angle[1].trim() : trimmed;
  return opts?.lower === false ? addr : addr.toLowerCase();
}

export function splitRecipients(value: string) {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  for (const ch of value) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "<") inAngle = true;
    else if (ch === ">") inAngle = false;
    if (ch === "," && !inQuotes && !inAngle) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts
    .map((entry) => parseAddressFromHeader(entry, { lower: false }))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ensureReplyPrefix(subject: string) {
  if (/^re:/i.test(subject.trim())) return subject.trim();
  return `Re: ${subject.trim() || "(No Subject)"}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function linkifyText(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#5B21B6;text-decoration:underline;">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

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

const ATTACHMENTS_MAX_BYTES = 24 * 1024 * 1024;

export function parseAttachments(
  raw: unknown
):
  | { ok: true; parts: Array<{ filename: string; contentType: string; base64: string }> }
  | { ok: false; message: string } {
  if (raw == null || raw === undefined) return { ok: true, parts: [] };
  if (!Array.isArray(raw)) return { ok: false, message: "attachments must be an array." };
  const parts: Array<{ filename: string; contentType: string; base64: string }> = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const filename = asStr(row.filename) || "attachment";
    const contentType = asStr(row.contentType) || "application/octet-stream";
    const contentBase64 = asStr(row.contentBase64);
    if (!contentBase64) continue;
    const byteLength = base64ToBytes(contentBase64).length;
    if (!byteLength) continue;
    total += byteLength;
    if (total > ATTACHMENTS_MAX_BYTES) {
      return { ok: false, message: "Attachments exceed size limit." };
    }
    parts.push({ filename, contentType, base64: contentBase64.replace(/\r?\n/g, "") });
  }
  return { ok: true, parts };
}

function chunkBase64ForMime(b64: string) {
  const clean = b64.replace(/\r?\n/g, "");
  return clean.match(/.{1,76}/g)?.join("\r\n") || clean;
}

/** Strip CR/LF so a crafted subject/recipient can't inject extra MIME headers (header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

/** RFC 2047-encode a subject that carries non-ASCII bytes (after stripping CR/LF). */
function encodeSubjectHeader(subject: string): string {
  const clean = headerSafe(subject);
  return /[^\x20-\x7E]/.test(clean) ? `=?UTF-8?B?${utf8ToBase64(clean)}?=` : clean;
}

/** Deno port of lib/gmail/gmailApi.ts's toBase64Url — base64url-encode a UTF-8 string. */
export function toBase64Url(value: string) {
  return utf8ToBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildRawMime(opts: {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  attachments: Array<{ filename: string; contentType: string; base64: string }>;
  inReplyTo: string;
  references: string;
  from?: string;
  dispositionNotificationTo?: string;
}) {
  const nl = "\r\n";
  const mixedBoundary = `mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;

  const headers: string[] = [
    ...(opts.from ? [`From: ${headerSafe(opts.from)}`] : []),
    `To: ${headerSafe(opts.to)}`,
    "MIME-Version: 1.0",
    `Subject: ${encodeSubjectHeader(opts.subject)}`,
  ];
  if (opts.cc) headers.push(`Cc: ${headerSafe(opts.cc)}`);
  if (opts.bcc) headers.push(`Bcc: ${headerSafe(opts.bcc)}`);
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${headerSafe(opts.inReplyTo)}`);
  if (opts.references) headers.push(`References: ${headerSafe(opts.references)}`);
  else if (opts.inReplyTo) headers.push(`References: ${headerSafe(opts.inReplyTo)}`);
  if (opts.dispositionNotificationTo) {
    headers.push(`Disposition-Notification-To: ${headerSafe(opts.dispositionNotificationTo)}`);
    headers.push(`Return-Receipt-To: ${headerSafe(opts.dispositionNotificationTo)}`);
  }

  const altInner =
    `--${altBoundary}${nl}Content-Type: text/plain; charset=UTF-8${nl}${nl}${opts.textBody}${nl}${nl}` +
    `--${altBoundary}${nl}Content-Type: text/html; charset=UTF-8${nl}${nl}${opts.htmlBody}${nl}${nl}` +
    `--${altBoundary}--`;

  if (opts.attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return `${headers.join(nl)}${nl}${nl}${altInner}`;
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

  const firstPart =
    `--${mixedBoundary}${nl}Content-Type: multipart/alternative; boundary="${altBoundary}"${nl}${nl}${altInner}${nl}`;

  const rest = opts.attachments
    .map((att) => {
      const body = chunkBase64ForMime(att.base64);
      const safeName = att.filename.replace(/[\r\n"]/g, "_");
      return (
        `--${mixedBoundary}${nl}Content-Type: ${att.contentType}; name="${safeName}"${nl}` +
        `Content-Disposition: attachment; filename="${safeName}"${nl}` +
        `Content-Transfer-Encoding: base64${nl}${nl}${body}${nl}`
      );
    })
    .join("");

  return `${headers.join(nl)}${nl}${nl}${firstPart}${rest}--${mixedBoundary}--`;
}
