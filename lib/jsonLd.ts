/**
 * Serialise structured data for a `<script type="application/ld+json">` block.
 *
 * `JSON.stringify` alone is not safe inside a script element: the HTML parser looks for the literal
 * text `</script` before the JavaScript/JSON parser ever sees the string, so a value containing
 * `</script>` closes the block early and everything after it is parsed as markup. Escaping `<` as
 * a `<` sequence is still valid JSON — and still the same string once parsed — while making
 * that impossible. It also neutralises `<!--`, which can start an HTML comment inside a script.
 *
 * The data here comes from panel-authored content (post titles and excerpts, job descriptions, FAQ
 * answers), so this is the boundary where that content reaches a public page.
 *
 * Note the doubled backslash: the replacement has to emit a literal backslash followed by `u003c`.
 * Writing "<" would be the `<` character itself, making the replace a silent no-op — which is
 * exactly what the tests caught on the first attempt.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
