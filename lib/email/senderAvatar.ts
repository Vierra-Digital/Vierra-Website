import { createHash } from "crypto";

/**
 * Ordered avatar sources for an email sender.
 *
 * The panel previously showed a picture only when the sender was saved in the user's own Google
 * Contacts (`people:searchContacts` / `me/connections`). For every other sender the API returned an
 * empty string, so the avatar fell straight through to initials — which reads as "profile pictures
 * don't load" when in fact there was never a photo to load.
 *
 * These are public, keyless sources tried in descending order of trustworthiness. Each returns 404
 * when it has nothing, so the client can advance to the next candidate and finally to initials.
 */

/** Gravatar: md5 of the trimmed, lowercased address (per the Gravatar spec). */
export function gravatarHash(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Gravatar URL. `d=404` is deliberate: the default is a generated placeholder, which would mask
 * "no avatar exists" as a successful load and stop us falling through to a better source.
 */
export function gravatarUrl(email: string, size = 80): string {
  return `https://www.gravatar.com/avatar/${gravatarHash(email)}?s=${size}&d=404`;
}

/** The sender's domain, lowercased; "" when the address is unusable. */
export function senderDomain(email: string): string {
  const domain = (email.split("@")[1] || "").trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : "";
}

/** Free-mail domains where a favicon would just be the provider's logo for every sender. */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

/**
 * Company favicon as an avatar — recognisable for business senders. Skipped for consumer domains,
 * where it would render the same Gmail/Outlook glyph on every message and carry no information.
 */
export function faviconUrl(email: string, size = 64): string {
  const domain = senderDomain(email);
  if (!domain || CONSUMER_DOMAINS.has(domain)) return "";
  // gstatic's faviconV2 directly rather than www.google.com/s2/favicons — the latter 301-redirects
  // here anyway, so this saves a round trip per avatar. Verified returning image/png.
  return (
    "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL" +
    `&size=${size}&url=${encodeURIComponent(`https://${domain}`)}`
  );
}

/**
 * Candidate avatar URLs, best first. The client walks this list on image error and shows the
 * initials avatar once it runs out. Duplicates and empties are removed so the walk can't stall.
 */
export function senderAvatarCandidates(email: string, contactPhotoUrl?: string | null): string[] {
  return senderAvatarSources(email, contactPhotoUrl).map((source) => source.url);
}

/** A candidate plus how it should be rendered — a headshot fills the circle, a logo must not. */
export type SenderAvatarSource = { url: string; kind: "photo" | "logo" };

/**
 * Ordered candidates with render hints.
 *
 * Requesting 2x the display size keeps both a photo and a favicon crisp on retina, and tagging the
 * favicon as a logo lets the UI contain it with padding instead of cropping it to a circle — a
 * cropped, stretched favicon is what made these look poor even when they loaded.
 */
export function senderAvatarSources(email: string, contactPhotoUrl?: string | null): SenderAvatarSource[] {
  const trimmedEmail = (email || "").trim();
  const hasAddress = trimmedEmail.includes("@");
  const sources: SenderAvatarSource[] = [
    { url: (contactPhotoUrl || "").trim(), kind: "photo" },
    { url: hasAddress ? gravatarUrl(trimmedEmail, 160) : "", kind: "photo" },
    { url: hasAddress ? faviconUrl(trimmedEmail, 128) : "", kind: "logo" },
  ];
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
