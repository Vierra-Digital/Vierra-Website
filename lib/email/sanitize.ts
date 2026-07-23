import sanitizeHtml from "sanitize-html";

/**
 * Canonical sanitizer for rich email HTML — the single source for outgoing mail bodies
 * (lib/gmail/sendCore) and the confidential-message viewer (lib/email/confidential). Allows
 * common formatting tags + inline style/class; blocks scripts and non-http(s)/mailto/data
 * schemes. The `"*": ["style","class"]` wildcard covers every tag, so per-tag style/class
 * entries aren't repeated.
 */
export function sanitizeRichEmailHtml(html: string): string {
  return sanitizeHtml(html, {
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
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
  });
}
