import sanitizeHtml from "sanitize-html";

// Style values must not contain `url(` — blocks remote-loading styles (e.g.
// background:url(https://attacker/x)) that would beacon a viewer's IP on render.
const NO_URL = [/^(?!.*url\s*\().*$/i];
// Safe style-property whitelist for HTML rendered inside OUR origin (the confidential viewer).
// Only these properties survive, and none can carry a url(); background-image/background
// shorthand are dropped entirely.
const RESTRICTED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: NO_URL,
    "background-color": NO_URL,
    "font-family": NO_URL,
    "font-size": NO_URL,
    "font-weight": NO_URL,
    "font-style": NO_URL,
    "text-align": NO_URL,
    "text-decoration": NO_URL,
    "line-height": NO_URL,
    margin: NO_URL,
    padding: NO_URL,
    border: NO_URL,
    "border-radius": NO_URL,
    width: NO_URL,
    "max-width": NO_URL,
    height: NO_URL,
    display: NO_URL,
    "vertical-align": NO_URL,
  },
};

/**
 * Canonical sanitizer for rich email HTML — the single source for outgoing mail bodies
 * (lib/gmail/sendCore) and the confidential-message viewer (lib/email/confidential). Allows
 * common formatting tags + inline style/class; blocks scripts and non-http(s)/mailto/data
 * schemes. The `"*": ["style","class"]` wildcard covers every tag, so per-tag style/class
 * entries aren't repeated.
 */
export function sanitizeRichEmailHtml(html: string, opts?: { restrictStyles?: boolean }): string {
  return sanitizeHtml(html, {
    ...(opts?.restrictStyles ? { allowedStyles: RESTRICTED_STYLES } : {}),
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "span",
      "div",
      "font",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel", "style", "class"],
      img: ["src", "alt", "width", "height", "style", "class"],
      td: ["colspan", "rowspan", "style", "class"],
      th: ["colspan", "rowspan", "style", "class"],
      font: ["color", "face", "size"],
      "*": ["style", "class"],
    },
    // `data:` is allowed ONLY for <img> (inline images); a data: href is never legitimate and
    // is a phishing/XSS vector, so it's kept out of the global scheme set.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
  });
}
