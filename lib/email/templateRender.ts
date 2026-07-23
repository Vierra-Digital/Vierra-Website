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
 *
 * Spintax requires no whitespace padding around the delimiter ({Hi|Hey}, {Hi there|Hello}) so
 * incidental prose/markup with a padded pipe ("Sizes: {small | large}") is left untouched.
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
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (match, group: string) => {
    const options = group.split("|");
    // Real spintax has no whitespace around its delimiters. If any option is padded, this is
    // incidental content (e.g. "{small | large}"), not spintax — leave it exactly as written.
    if (options.some((o) => o !== o.trim())) return match;
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
