/**
 * Template rendering for the template library: merge tokens with fallbacks and spintax.
 *
 *   Tokens:  {{firstName}} · {{firstName|there}} (fallback when empty)
 *   Spintax: {Hi|Hey|Hello}  → one option, chosen deterministically per `seed`
 *            so the same recipient always sees the same variant (reproducible sends).
 *
 * Tokens resolve first, then spintax — so tokens inside a spintax option
 * ({Hi {{firstName}}|Hey {{firstName}}}) resolve correctly, and {{a|b}} isn't
 * mistaken for spintax.
 */

export type TemplateVars = Record<string, string | null | undefined>;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function resolveTokens(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (_m, key: string, fallback?: string) => {
    const v = vars[key];
    if (v != null && String(v).trim()) return String(v);
    return fallback != null ? fallback : "";
  });
}

function resolveSpintax(text: string, seed: string): string {
  let counter = 0;
  // Non-nested {a|b|c}. Runs after tokens so double-brace tokens are already gone.
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, group: string) => {
    const options = group.split("|");
    const idx = hashString(`${seed}:${counter}`) % options.length;
    counter += 1;
    return options[idx];
  });
}

export function renderTemplate(text: string, vars: TemplateVars, seed?: string): string {
  if (!text) return "";
  const withTokens = resolveTokens(text, vars);
  return resolveSpintax(withTokens, seed || String(vars.email || "seed"));
}

/** True if the text contains any spintax group (for editor previews / validation). */
export function hasSpintax(text: string): boolean {
  return /\{[^{}]*\|[^{}]*\}/.test(text);
}
