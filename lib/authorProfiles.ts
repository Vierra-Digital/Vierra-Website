// Author profiles for the blog. Powers two E-E-A-T signals:
//   1. Person `sameAs` (LinkedIn etc.) so search engines / LLMs can disambiguate
//      the author entity.
//   2. A visible author-bio block + Person `jobTitle`/`description`/`image`, which
//      Google's guidelines weight for expertise/authorship on advice content.
//
// To add or complete an author, fill in the fields below. Any field left out is
// simply omitted (the bio block hides itself when `bio` is empty, and
// JSON.stringify drops undefined schema fields), so partial profiles are safe.

export type AuthorProfile = {
  /** Public profile URLs (LinkedIn, X, etc.) -> Person.sameAs. */
  sameAs?: string[]
  /** Role/title, shown under the name and as Person.jobTitle. e.g. "Founder". */
  jobTitle?: string
  /** Employer shown next to the title and used for Person.worksFor. Defaults to
   *  "Vierra Digital" when omitted. Set it when the author's day job is elsewhere. */
  company?: string
  /** 1-3 sentence bio. Shown in the author card and as Person.description. */
  bio?: string
  /** Headshot path in /public, e.g. "/assets/Team/Alex.png" -> Person.image. */
  image?: string
}

/** Employer label for an author, defaulting to Vierra Digital. */
export function authorCompany(name: string): string {
  return AUTHOR_PROFILES[name]?.company ?? "Vierra Digital"
}

const AUTHOR_PROFILES: Record<string, AuthorProfile> = {
  "Alex Shick": {
    sameAs: ["https://www.linkedin.com/in/alexshick/"],
    jobTitle: "Founder",
    image: "/assets/Team/Alex.png",
    // Draft — edit to taste. Kept factual (founder, 2019) so nothing is invented.
    bio: "Alex Shick is the founder of Vierra Digital, which he launched in 2019 to help businesses scale with risk-averse, guaranteed lead generation. He writes about marketing systems, sales psychology, and what actually moves pipeline for growing companies.",
  },
  "Paul Wahba": {
    sameAs: ["https://www.linkedin.com/in/paul-wahba-2306b2279/"],
    jobTitle: "Account Executive",
    company: "NewDay USA",
    image: "/assets/Team/Paul.png",
    // Draft based on role — edit to add real specifics (background, focus, wins).
    bio: "Paul Wahba is an Account Executive at NewDay USA, where he works directly with veterans and military families to guide them through VA home loan financing. He focuses on building trusted client relationships, understanding each family's goals, and helping them navigate the mortgage process with clarity.",
  },
  "Kylie Lappin": {
    sameAs: ["https://www.linkedin.com/in/kylie-lappin-b3677b32a/"],
    jobTitle: "Writer & Publisher",
    company: "Pathos Communications",
    image: "/assets/Team/Kylie.png",
    // Draft based on role — edit to add real specifics (background, focus, wins).
    bio: "Kylie Lappin is a Writer and Publisher at Pathos Communications, where she develops brand storytelling, editorial content, and messaging for clients. She writes about marketing, communications, and how brands connect with the audiences they want to reach.",
  },
}

/** Full profile for an author, or an empty object if unknown. */
export function getAuthorProfile(name: string): AuthorProfile {
  return AUTHOR_PROFILES[name] ?? {}
}

/**
 * `sameAs` array for the given author, or `undefined` if none is known.
 * `undefined` is dropped by JSON.stringify, so callers can spread this straight
 * into a Person object without conditionals.
 */
export function authorSameAs(name: string): string[] | undefined {
  const sameAs = AUTHOR_PROFILES[name]?.sameAs
  return sameAs && sameAs.length ? sameAs : undefined
}
