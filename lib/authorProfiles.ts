// Public LinkedIn profiles for blog authors. Used to attach `sameAs` to the
// Person schema so search engines and LLMs can disambiguate the author entity
// (an E-E-A-T / authorship signal). Add new authors here as profiles are known.
const AUTHOR_LINKEDIN: Record<string, string> = {
  "Alex Shick": "https://www.linkedin.com/in/alexshick/",
  "Paul Wahba": "https://www.linkedin.com/in/paul-wahba-2306b2279/",
}

/**
 * Returns a `sameAs` array for the given author name, or `undefined` if no
 * profile is known. `undefined` keys are dropped by JSON.stringify, so callers
 * can spread this directly into a Person object without conditionals.
 */
export function authorSameAs(name: string): string[] | undefined {
  const url = AUTHOR_LINKEDIN[name]
  return url ? [url] : undefined
}
