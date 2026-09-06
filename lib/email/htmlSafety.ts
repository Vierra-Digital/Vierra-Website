/**
 * Safety decisions for inbound email HTML rendered inside the panel.
 *
 * The panel renders message bodies with dangerouslySetInnerHTML through a DOM-based sanitizer.
 * That sanitizer cannot use lib/email/sanitize (sanitize-html is 1.1MB and server-only), so it
 * walks the parsed document itself — which left three gaps, each confirmed against a real DOM:
 *
 *   - `<a href="javascript:...">` survived. Stripping `on*` attributes does not help: the scheme
 *     was never checked, so a link in an email anyone can send executed script in our origin as
 *     soon as the reader clicked it.
 *   - `background:url(https://attacker/p)` survived, beaconing the reader's IP and open time on
 *     render. The panel already removes tracking pixels "so opens aren't leaked back to the
 *     sender" — this leaked the same signal through CSS instead, so the stated defence had a hole
 *     straight through it.
 *   - `<form action="https://attacker"><input type="password">` survived, giving a sender a
 *     credential form rendered inside the panel's own chrome.
 *
 * The DOM walking has to stay where a DOM exists. These are the decisions it makes, kept pure so
 * they can be tested without one.
 */

/**
 * Schemes a link in an email may use. Everything else — `javascript:`, `vbscript:`, `data:`,
 * `file:` — is dropped rather than rewritten, so a stripped link stays visible as text instead of
 * silently becoming a different destination.
 *
 * `data:` is refused here even though lib/email/sanitize allows it on `<img src>`: an image cannot
 * navigate, an anchor can.
 */
/**
 * Whitespace and C0 control characters, stripped before a scheme is read. A tab or newline
 * inside the scheme ("java<TAB>script:") navigates exactly the same, so a check that trusts the
 * raw string is not a check. Spelled as an escape range rather than literal bytes.
 */
const CONTROL_CHARS = /[\u0000-\u0020]/g;

/** Any `url(` in a declaration, however spaced or cased — `URL (` fetches just as well. */
const HAS_CSS_URL = /url\s*\(/i;

const SAFE_HREF_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Whether an href may be kept. Relative and protocol-relative URLs are allowed — they resolve
 * against our own origin, which is where the reader already is.
 */
export function isSafeEmailHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;

  // A leading control character or whitespace inside the scheme is the classic way to smuggle
  // `java\tscript:` past a naive prefix check, so normalise before looking at all.
  const normalized = trimmed.replace(CONTROL_CHARS, "");
  if (!normalized) return false;

  // Fragment, query, absolute and relative paths carry no scheme and cannot navigate elsewhere.
  if (/^[#?/]/.test(normalized)) return true;

  const colon = normalized.indexOf(":");
  if (colon === -1) return true; // e.g. "example.html"

  // A colon after the first path separator is part of the path, not a scheme.
  const firstSlash = normalized.search(/[/?#]/);
  if (firstSlash !== -1 && firstSlash < colon) return true;

  return SAFE_HREF_SCHEMES.has(normalized.slice(0, colon + 1).toLowerCase());
}

/**
 * Drop any style declaration that would fetch a remote resource.
 *
 * Matching on `url(` rather than on specific properties is deliberate: `background`,
 * `background-image`, `border-image`, `list-style-image`, `cursor`, `mask` and `content` can all
 * carry one, and a property-name allowlist would have to keep pace with CSS. Whitespace and case
 * are normalised first because `URL (` and `url\t(` load just as well.
 *
 * Returns the surviving declarations, or "" when nothing survives, so the caller can remove the
 * attribute entirely rather than leave `style=""` behind.
 */
export function stripRemoteUrlsFromStyle(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration !== "" && !HAS_CSS_URL.test(declaration))
    .join("; ");
}

/**
 * Elements removed outright from an email body.
 *
 * `script`, `style`, `iframe`, `object` and `embed` were already handled. The form elements are
 * the addition: a sender has no legitimate reason to put an input in a message body, and the panel
 * renders it inside its own chrome where it reads as part of the application.
 *
 * `base`, `link` and `meta` are included for completeness. DOMParser currently sorts them into
 * `<head>` and the caller only returns `body.innerHTML`, so they are dropped today by accident
 * rather than on purpose — which is not a property to rely on.
 */
export const UNSAFE_EMAIL_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "base",
  "link",
  "meta",
  // SVG animation elements. `<a href="#x"><animate attributeName="href" values="javascript:...">`
  // retargets the anchor when the animation runs, so a scheme check performed once at sanitise
  // time is not enough. Nothing in an email body legitimately animates an attribute.
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
] as const;

/** The selector the DOM sanitizer passes to querySelectorAll. */
export const UNSAFE_EMAIL_TAG_SELECTOR = UNSAFE_EMAIL_TAGS.join(", ");
