# Vierra — Full SEO Audit (Homepage Redesign)

**Domain:** https://vierradev.com
**Audit scope:** Site-wide SEO + the new redesigned homepage on branch `homepage-redesign` (`app/page.tsx` + section components, not yet deployed to production)
**Method:** Source-level analysis + local SSR render (Googlebot UA against dev server) + live production header/redirect checks. Field CWV data not available (no CrUX/GSC/GA4 credentials configured).
**Date:** 2026-07-10

---

> **Update:** This report now incorporates six additional specialist analyses (GEO/AEO, Local, Search Experience, Backlinks, Content Clustering, and Copy). See **Section 8** and the per-topic files in `findings/`. The AI-readiness score is revised down after the deeper entity-consistency findings; overall score is now **80/100**.

## Executive Summary

### Overall SEO Health Score: **80 / 100** — Good (B)

This is a **well-engineered site with a strong technical and structured-data foundation**. The redesigned homepage — despite being a `"use client"` component with heavy Framer Motion animation and WebGL — is **fully server-rendered**: the `<h1>`, hero copy, section headings, body text, footer, canonical, OpenGraph, and JSON-LD all appear in the initial HTML a crawler receives (1,287 crawlable words, exactly one `<h1>`, all 30 images carry `alt`). The client-rendering fear that usually accompanies this stack does **not** apply here.

The score is held back by three themes, none of them catastrophic:
1. **Data/brand inconsistency** across public surfaces (NAP location conflict, founding-year conflict, and a "Guaranteed Leads" vs "Risk-Averse Lead Engine" split-brand between the website and the AI-crawler files).
2. **Homepage semantic/crawlability gaps** in the redesign (`<main>` wraps only the hero, duplicate `id="cases"`, several sections show only one client-rotated variant in the DOM, two prominent visual headings not marked up as headings).
3. **Unvalidated performance** on a heavy redesign — no field CWV data, and a pervasive `opacity:0`-until-animated pattern that risks a blank page if hydration fails.

### Category Scores

| Category | Weight | Score | Grade |
|---|---|---|---|
| Technical SEO | 22% | 88 | A- |
| Content Quality | 23% | 80 | B |
| On-Page SEO | 20% | 79 | C+ |
| Schema / Structured Data | 10% | 82 | B |
| Performance (CWV) | 10% | 70 | C |
| AI Search Readiness | 10% | 73 | C |
| Images | 5% | 88 | A- |
| **Weighted total** | **100%** | **80** | **B** |

### Top 5 Critical / High Issues

1. **Broken import in the redesign (build integrity).** `components/BusinessSection/Timeline.tsx:12` still dynamically imports the deleted `./OnboardingModels3D`; the replacement `OnboardingSteps.tsx` exists but is not wired in. SSR survives (it's `ssr:false` with a loading fallback), but the "How Onboarding Works" visual is broken client-side and the dev build throws `Module not found`. *(Uncommitted WIP — flag, not an SEO defect per se.)*
2. **NAP location conflict.** Site-wide Organization/LocalBusiness schema says **Cambridge, MA** (`app/layout.tsx:169-175`), but every `JobPosting.jobLocation` and all careers copy say **New York, NY** (`pages/careers/[slug].tsx:124-132`, `lib/careers.ts:28`). NAP consistency is a local-ranking signal and Google Jobs will place roles in the wrong city.
3. **`<main>` landmark covers only the hero.** Every section after the hero renders as a sibling *outside* `<main>` (`app/page.tsx:126-199` vs `:289-321`), misrepresenting the page's primary content region to crawlers and assistive tech.
4. **Split-brand across AI-facing files.** `public/llms.txt`, `public/manifest.json`, and `content/md/index.md` still lead with "Guaranteed Leads," while the live site is "Risk-Averse Lead Engine." AI answer engines read exactly those files and will cite a stale, off-message (and legally loaded) value prop.
5. **Founding-year contradiction.** Schema says `foundingDate: "2019"` (`app/layout.tsx:190,261`); `public/llms.txt:16` says `Founded: 2024`.

### Top 5 Quick Wins

1. Fix the `Timeline.tsx` import to point at the new step component (or restore the file) — unblocks the redesign.
2. Rename the duplicate `id="cases"` (Testimonials → `id="testimonials"`) — invalid HTML that breaks anchor scrolling (`CaseStudies.tsx:12` / `Testimonials.tsx:144`).
3. Reconcile founding year and location across `llms.txt`, `manifest.json`, and schema.
4. Promote "Scale Your Business" (`StatsGrid.tsx:150`) and footer CTA "Want To Explode Profits?" (`MainComponent.tsx:88`) from `<span>`/`<div>` to `<h2>`.
5. Lengthen the short/generic titles on `/blog` (13 chars), `/careers` (16), `/branding` (18).

---

## 1. Technical SEO — 88 / 100

### What works (verified on live production)
- **HTTPS enforced** with HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains`).
- **Security headers present:** CSP (comprehensive), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. `poweredByHeader: false`.
- **Redirects correct:** `www.vierradev.com → vierradev.com` (301) and `http → https` (301).
- **robots.txt** (`public/robots.txt`): sensibly disallows app/admin/auth paths, allows blog + RSS, declares sitemap, sets a crawl-delay, and **explicitly allows AI search crawlers** (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended).
- **Sitemap** (`app/sitemap.ts`): dynamic with **ISR (`revalidate: 3600`)** so newly published posts appear without a redeploy; filters out test/bracket slugs; correctly **excludes noindex tag archives** while keeping author pages; includes static, careers, blog, and author URLs. Live sitemap returns 30 URLs.
- **Image pipeline** (`next.config.js`): AVIF → WebP with fallback; remote-pattern allowlist.
- Served behind **Cloudflare** CDN.

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| T1 | Redesign has a broken dynamic import (build throws `Module not found`) | High (build) | `components/BusinessSection/Timeline.tsx:12,108,198` import deleted `./OnboardingModels3D`; new `OnboardingSteps.tsx` unwired | Rewire Timeline to the new component before merge |
| T2 | `WebSite` `SearchAction` points at a non-functional endpoint | Medium | `app/layout.tsx:215` targets `/blog?search=…`, but `pages/blog.tsx` never reads the query param (`:78`) | Wire `/blog` to hydrate search from the URL, or remove the SearchAction |
| T3 | `X-Frame-Options` header absent | Low | `next.config.js:33-68` | Covered by CSP `frame-ancestors 'self'`; add `X-Frame-Options: SAMEORIGIN` for older-crawler defense-in-depth |
| T4 | `<main>` landmark scope (see On-Page O1) | High | `app/page.tsx:126-321` | Wrap all primary content in one `<main>` |

---

## 2. Content Quality — 80 / 100

### What works
- **Deep legal/policy pages** (Privacy 18 sections, Terms 24, Work Policy 18) — one H1 + numbered H2 per section.
- **Blog posts have real E-E-A-T:** author byline + link, published/modified dates, `article:author`, `sameAs` author profiles (`pages/blog/[slug].tsx`).
- **Careers content is deep** (10 roles, each with about/responsibilities/qualifications/benefits).
- **Homepage has substantive crawlable copy** (1,287 words) plus an `.sr-only` "About Vierra" descriptive block (`app/page.tsx:177-186`).

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| C1 | Split-brand: "Guaranteed Leads" vs "Risk-Averse Lead Engine" | High | `public/llms.txt:6,29,32,34,75`; `public/manifest.json:2,4`; `content/md/index.md:2,3,7,13` vs `app/layout.tsx:20` | Migrate AI/PWA files to "Risk-Averse Lead Engine"; drop "guaranteed" (also a legal-claim risk) |
| C2 | Blog **author pages are indexable but thin** — card grid only, ~44-char templated description, no bio/photo/credentials | Medium | `pages/blog/author/[name].tsx:39-42,143-196` | Add author bio + avatar + role, or `noindex` if staying thin |
| C3 | Homepage "Flood Your Sales Calendar" is a thin **"Coming Soon" placeholder** | Medium | `components/WorkSection/CaseStudies.tsx:20-64` | Add real case-study results text, or de-emphasize the keyword-named section |
| C4 | Client-rotated sections expose only 1 variant in SSR (see H-page section) | Medium | `BusinessSolutions.tsx:113`, `Testimonials.tsx:140`, `StatsGrid.tsx:53-69` | Render all variants in DOM, toggle with CSS |
| C5 | FAQ has only 9 Q&A | Low | `lib/faq.ts` | Expand to 12–15 for topical coverage / more FAQ rich-result surface |
| C6 | Stale markdown mirror lists "HappyStack" as a partner not on the live strip | Low | `content/md/index.md:19` vs `app/page.tsx:220-278` | Sync the mirror |

---

## 3. On-Page SEO — 79 / 100

### What works
- Homepage: strong 50-char title, unique description, canonical, robots, OG, Twitter, exactly one `<h1>`.
- Most templates have unique dynamic titles/descriptions, canonicals, and OG/Twitter tags.
- Blog post OG uses `og:type=article` with published/modified/author/tags.

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| O1 | `<main>` wraps only the hero; all other sections are siblings outside it | High | `app/page.tsx:126-199` vs `:289-321` | Wrap full primary content in `<main>` |
| O2 | Duplicate `id="cases"` on two sections (invalid HTML, breaks anchor scroll) | Medium | `CaseStudies.tsx:12` & `Testimonials.tsx:144` | Rename Testimonials to `id="testimonials"` |
| O3 | Two prominent visual headings not marked as headings | Medium | `StatsGrid.tsx:150` (`<span>`), `MainComponent.tsx:88` (`<div>`) | Promote both to `<h2>` |
| O4 | Short/generic titles | Medium | `/blog` "Vierra \| Blog" 13 chars (`pages/blog.tsx:162`); `/careers` 16 (`pages/careers.tsx:18`); `/branding` 18 (`pages/branding.tsx:136`) | Expand to keyword-rich 30–60 chars |
| O5 | Heading-level skip (H1 → H3) on author & tag listing pages | Low | `pages/blog/author/[name].tsx:145,177`; `tag/[tag].tsx:141,173` | Add an H2 section label |
| O6 | Homepage meta description ~164 chars (over 160) and differs from OG/Twitter variant | Low | `app/layout.tsx:23-24` vs `:58,77` | Trim to ≤160 and align variants |
| O7 | Missing OG/Twitter images on legal + branding pages | Medium | `privacy-policy.tsx`, `terms-of-service.tsx`, `work-policy.tsx`, `branding.tsx` (no image tags) | Add shared `meta-banner.png`; upgrade branding to `summary_large_image` |
| O8 | Duplicate `<h2>` "How Onboarding Works" (desktop + mobile blocks both in DOM) | Low | `Timeline.tsx:121,189` | Acceptable responsive pattern; optional cleanup |

---

## 4. Schema / Structured Data — 82 / 100

### What works (excellent coverage)
Site-wide: `Organization`, `WebSite` (+`SearchAction`), `ProfessionalService`/`LocalBusiness` (`app/layout.tsx`). Per-template: `BlogPosting` + `BreadcrumbList` (blog post), `Blog` (listing), `CollectionPage` + `BreadcrumbList` (author/tag), `FAQPage` (faq), `ItemList` + `BreadcrumbList` (careers), and a **best-in-class `JobPosting`** with `validThrough`, `employmentType` enum mapping, `baseSalary` as `MonetaryAmount`, and `directApply`.

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| S1 | NAP conflict — MA entity vs NYC `JobPosting.jobLocation` | High | `app/layout.tsx:169-175` vs `pages/careers/[slug].tsx:124-132` | Reconcile: add NYC as a real second location or correct the job location |
| S2 | `foundingDate` 2019 (schema) vs 2024 (`llms.txt`) | Medium | `app/layout.tsx:190,261` vs `public/llms.txt:16` | Pick the correct year, align both |
| S3 | Blog-listing `publisher.logo` uses `meta-banner.png` (a 1200×630 social image) with no dimensions | Medium | `pages/blog.tsx:238-241` | Use `vierra-logo.png` (464×188) like every other block |
| S4 | Homepage emits **no page-level schema** (only inherited site-wide) | Medium | `app/page.tsx` | Add `Service`/`OfferCatalog` enumerating the agency's services |
| S5 | Author pages use `CollectionPage`, not `ProfilePage` → `Person` | Medium | `pages/blog/author/[name].tsx:70-119` | Wrap author in `ProfilePage` for stronger authorship signal |
| S6 | `LocalBusiness` type may invite local-pack mismatch for a national B2B agency | Low | `app/layout.tsx:222-287` | Consider `Organization` + `ProfessionalService` only, unless actively pursuing map-pack |
| S7 | All `BlogPosting.image` use the generic banner | Low | `pages/blog/[slug].tsx:150` | Use per-post hero image when available |

---

## 5. Performance (Core Web Vitals) — 70 / 100

> **No field data.** No CrUX/GSC/GA4 credentials were configured, and a production Lighthouse run was not performed. This score is a **risk-weighted estimate** from architecture review and should be validated with a real Lighthouse/CrUX run before/after deploying the redesign.

### What works
- **WebGL is code-split** (`dynamic(..., { ssr: false })`) so `three.js` stays out of the initial bundle (`Timeline.tsx:12`, `BrandSphere.tsx:9`). Only `BrandSphere3D.tsx` imports `three`.
- **Reduced-motion respected** in Timeline, BrandSphere, FeatureBento, PipelineGrid.
- The onboarding refactor **replaces WebGL step-models with lighter DOM/SVG/Framer animations** (`OnboardingSteps.tsx`) — a net performance improvement once wired in.
- AVIF/WebP image optimization; `preconnect`/`dns-prefetch` hints in `<head>`.
- Hero `<h1>` deliberately paints without an opacity fade to protect LCP (documented in `app/page.tsx:29-38`).

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| P1 | Entire homepage is `"use client"` — the whole tree hydrates, inflating JS/INP cost around the LCP | Medium | `app/page.tsx:1` | Keep the page a Server Component; push `"use client"` down to interactive leaves (modal, animated sections) |
| P2 | Near-universal `initial="hidden"` / `whileInView` with inline `opacity:0` until animated | Medium | `FeaturesV2.tsx:24-29`, `StatsGrid.tsx:72-76`, `FeatureBento.tsx:14-18` | Ensure reduced-motion/no-JS default is visible; add resilience so a hydration failure doesn't blank the page |
| P3 | No measured LCP/INP/CLS | Medium | — | Run Lighthouse + pull CrUX after deploy; validate INP on mid-tier mobile given the animation density |
| P4 | Broken Timeline import may throw client-side, harming UX/CWV signals | High (until fixed) | `Timeline.tsx:12` | Fix before merge (see T1) |

---

## 6. AI Search Readiness (GEO) — 73 / 100

> Deep GEO/AEO analysis in [`findings/geo-aeo.md`](findings/geo-aeo.md). **Citability Score: 58/100.** The headline discovery: entity facts are inconsistent across **four** surfaces (live `llms.txt` = New York/2019, branch `llms.txt` = Cambridge/2024, schema = Cambridge/2019, careers = New York) — AI engines cannot state Vierra's basic facts correctly, and merging the branch as-is trades a 2-way conflict for a 3-way one. Client-rotated stats ("500k+ campaigns", "175+ businesses") never reach the DOM a crawler snapshots. No on-site passage directly defines "risk-averse lead generation" despite it being the core term.


### What works
- **`llms.txt` present** with org, services, contact, sitemap, and crawl guidance.
- **AI crawlers explicitly allowed** in robots.txt (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended).
- **`FAQPage` schema** + `<details>` that keep answers in the DOM while collapsed = highly citable Q&A.
- **Markdown mirror** (`content/md/`, served via `/api/md`) gives clean text for LLMs.
- `.sr-only` "About Vierra" summary provides a crawlable, quotable definition.

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| G1 | `llms.txt` is stale and off-message ("Guaranteed Leads," "Founded: 2024") | High | `public/llms.txt:6,16,29` | Update to match site positioning + correct facts — this is the file AI engines cite from |
| G2 | Homepage client-rotated content (channel tabs, testimonials, stats) not fully in DOM | Medium | `BusinessSolutions.tsx:113`, `Testimonials.tsx:140` | Render all variants so AI snapshots capture the full offering |
| G3 | Thin "Coming Soon" case-studies block reduces citable proof | Medium | `CaseStudies.tsx:20-64` | Publish real, quotable results |

---

## 7. Images — 88 / 100

### What works
- **All 30 homepage images carry `alt`** (0 missing). Decorative images correctly use `alt="" aria-hidden`; content images have meaningful alt (partner logos, team photos `alt={name}`, testimonial avatars).
- WebGL BrandSphere given a text alternative via `role="img" aria-label` (`BrandSphere.tsx:41-43`).
- AVIF/WebP via Next Image; declared `qualities:[80]`.

### Findings
| # | Issue | Severity | Evidence | Recommendation |
|---|---|---|---|---|
| I1 | Per-post/per-page OG images are all the generic banner | Low | `pages/blog/[slug].tsx:150` | Generate per-post OG images for richer social/AI cards |
| I2 | 9 empty-`alt` images on homepage | Info | verified decorative (loop avatars, 3D V logo, monday.svg with adjacent label) | Acceptable — no action |

---

## 8. Search Experience, Off-Page & Strategy (specialist reports)

Six deeper analyses were run as follow-ups. Full detail in `findings/`.

### 8.1 Search Experience / SXO — [`findings/sxo.md`](findings/sxo.md)
**SXO Gap Score 46/100.** The site is technically healthy but the homepage is the *wrong page type* for its target queries. For "B2B lead generation agency", "lead generation services", "appointment setting service", the SERP rewards a **Service Page** (named case studies with numbers, pricing or pricing link, process steps, team credentials). Vierra has none of that: the case-studies block is a "Coming Soon" placeholder, there is no `/services` or `/pricing` page, and the "risk-averse" guarantee is never explained on-page. Persona scores: Scaling Founder 57, Marketing Director 49, **Skeptical CFO 36 (critical mismatch)**. The single high-friction "Let's Talk" modal is the only CTA for every visitor regardless of funnel stage.
**Do:** ship real case studies; add a pricing/guarantee explainer; surface the FAQ; build a dedicated Service Page to absorb bottom-funnel intent.

### 8.2 Local SEO — [`findings/local.md`](findings/local.md)
NAP is inconsistent across **four+ surfaces** (see §6). **Cambridge, MA / 2019 should be canonical** (schema, meta geo, legal footers already agree). The branch mid-migration fixes location but regresses founding year to 2024 and invents a "Cambridge HQ + NYC office" FAQ that still doesn't match careers. No GBP embed, review widget, or `aggregateRating` anywhere — despite 8 strong (unmarked-up) testimonials. For a remote-first national B2B agency: treat Cambridge as canonical, only model NYC if there's a real addressable office, and prefer Service pages over city pages.

### 8.3 Off-Page / Backlinks — [`findings/backlinks.md`](findings/backlinks.md)
No backlink API tooling configured (no Moz/Bing/DataForSEO creds; no analysis scripts present). Free-source signals were thin (Wayback ~9 captures since 2024; Common Crawl inconclusive) so **no numeric score was fabricated**. 3 of 6 partner outbound links confirmed in raw HTML. Roadmap: verify reciprocal links from the 6 partner sites, claim agency directories (Clutch, GoodFirms), pursue Cambridge/Boston citations, publish client case studies, HARO/digital PR. Re-run once real backlink tooling is configured.

### 8.4 Content Clusters — [`findings/content-clusters.md`](findings/content-clusters.md)
Live blog has 11 DB-backed posts. Proposed **5 hub-and-spoke clusters / 25 posts** (4 existing refreshed + 21 new): B2B Lead Generation (pillar), Risk-Averse/Guaranteed Lead Generation (brand differentiator), Sales Pipeline & Appointment Setting (highest transactional value), Marketing Automation & GTM, and AEO/GEO & AI Search Visibility (low-competition, ties to Vierra's own service). Includes internal-link matrix, cannibalization check (2 existing posts reassigned rather than duplicated), and a 13-week calendar. Two pillars flagged as future dedicated landing pages once demand is validated.

### 8.5 Copy & Messaging — [`findings/copy-feedback.md`](findings/copy-feedback.md)
Editorial feedback (see the standalone summary below in this report's cover note). Headlines: **positioning-vs-proof mismatch** (enterprise "GTM autopilot" promise vs local-SMB testimonials — dentist/salon/yoga/Yelp), **tone whiplash** ("Risk-Averse" safety vs "Explode Profits" hype), the best differentiator (pay-after / "You Get Paid First") is buried, and feature names are clever but benefit-light.

## Appendix — Method & Coverage

- **Local SSR render:** dev server rendered `/` in full (HTTP 200, 266 KB HTML). Extracted head tags, heading tree (1×h1, 10×h2, 30×h3), 1,287 crawlable words, 30 images, 27 anchors, `<main>/<nav>/<section>×8/<footer>/<header>`, 0 `<canvas>` in SSR (WebGL is client-only by design).
- **Live production checks:** headers, HSTS, CSP, redirects, robots.txt (200), sitemap.xml (30 URLs) all verified against `https://vierradev.com`.
- **Not covered (needs credentials/tools):** CrUX field CWV, GSC indexation/impressions, GA4 organic traffic, backlink profile, live SERP positions. Configure Google APIs / DataForSEO to enrich these.
- **Note on the redesign:** the new homepage is on `homepage-redesign` and **not yet live**; production still serves the previous homepage. All homepage findings are from source + local render.
