import sanitizeHtml from "npm:sanitize-html@2.17.6";

/**
 * Deno port of lib/email/sanitize.ts's sanitizeRichEmailHtml. Same allowlist/scheme rules —
 * pure-JS library, no Node-native bindings, so this ports verbatim aside from the import
 * specifier. Kept as a straight copy rather than a shared import across runtimes since the two
 * `sanitize-html` packages (npm vs. Deno's npm compat) are resolved independently.
 */

const NO_URL = [/^(?!.*url\s*\().*$/i];
const RESTRICTED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: NO_URL,
    "background-color": NO_URL,
    "font-family": NO_URL,
    "font-size": NO_URL,
    "font-weight": NO_URL,
    "font-style": NO_URL,
    "text-align": NO_URL,
    "text-align-last": NO_URL,
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
      img: ["src", "alt", "width", "height", "align", "border", "hspace", "vspace", "style", "class"],
      table: ["align", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "style", "class"],
      tr: ["align", "valign", "bgcolor", "style", "class"],
      td: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "style", "class"],
      th: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "style", "class"],
      div: ["align", "style", "class"],
      p: ["align", "style", "class"],
      font: ["color", "face", "size"],
      "*": ["style", "class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
  });
}
