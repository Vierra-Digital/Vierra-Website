# Vierra — Combined SEO / AEO / GEO Audit (Homepage Redesign)

**Domain:** https://vierradev.com  
**Scope:** Site-wide SEO + the redesigned homepage on branch `homepage-redesign` (not yet deployed)  
**Date:** 2026-07-10  
**Overall SEO Health Score:** 80/100 (B) · GEO/AEO Citability 58/100 · SXO Gap 46/100

This single document combines the core audit with all six specialist reports. Each part below is the full standalone report.

---

## Master Table of Contents

1. **PART I — Core SEO Audit** — `FULL-AUDIT-REPORT.md`
2. **PART II — GEO & AEO (AI Search / Answer Engines)** — `findings/geo-aeo.md`
3. **PART III — Search Experience Optimization (SXO)** — `findings/sxo.md`
4. **PART IV — Local SEO & NAP** — `findings/local.md`
5. **PART V — Off-Page / Backlinks** — `findings/backlinks.md`
6. **PART VI — Content Cluster Strategy** — `findings/content-clusters.md`
7. **PART VII — Copy & Messaging** — `findings/copy-feedback.md`
8. **PART VIII — Consolidated Action Plan** — `ACTION-PLAN.md`

---



<br>

# PART I — Core SEO Audit

<sub>Source file: `vierradev.com-audit/FULL-AUDIT-REPORT.md`</sub>


---

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


---



<br>

# PART II — GEO & AEO (AI Search / Answer Engines)

<sub>Source file: `vierradev.com-audit/findings/geo-aeo.md`</sub>


---

# GEO / AEO Findings — Passage Citability, Entity Grounding, Platform Readiness

Scope: builds on prior GEO pass (robots.txt AI-crawler allowlist, stale llms.txt, FAQPage schema,
markdown mirror, sr-only summary, client-rotated homepage sections). This pass goes deeper on
passage-level citability, llms.txt structure, entity/NAP consistency across ALL surfaces
(live prod, redesign-branch source, schema, FAQ, careers), and content gaps.

Sources checked: `lib/faq.ts`, `pages/faq.tsx`, `app/page.tsx`, `app/layout.tsx`, `public/llms.txt`
(repo), `public/robots.txt`, `content/md/index.md`, `pages/blog/[slug].tsx`, `lib/blog.ts`,
`lib/authorProfiles.ts`, `pages/careers/[slug].tsx`, `components/BusinessSection/StatsGrid.tsx`,
and live `https://vierradev.com`, `https://vierradev.com/llms.txt`, `https://vierradev.com/faq`.

---

## 0. Critical discovery: THREE different entity records, not two

The original pass flagged repo-`llms.txt` vs schema as conflicting (2024 vs 2019, Cambridge vs
NAP conflict). Live fetches show it's worse — **the live llms.txt is a third, independent
version**, different from both the repo file and the schema:

| Surface | Founded | Location | Positioning |
|---|---|---|---|
| **Live** `vierradev.com/llms.txt` (fetched now) | **2019** | **New York, NY 10001** | "guaranteed, risk-averse lead generation" |
| **Repo** `public/llms.txt` (homepage-redesign, unreleased) | **2024** | **Cambridge, MA 02138** | "Guaranteed Leads" / "guaranteed lead generation services" |
| `app/layout.tsx` Organization + LocalBusiness JSON-LD | 2019 | Cambridge, MA 02138 | "Risk-Averse Lead Engine" |
| `pages/careers/[slug].tsx` JobPosting schema | — | **New York, NY** | — |
| `lib/faq.ts` "Where is Vierra located?" | — | Cambridge, MA **with a NYC office** | — |
| `content/md/index.md` (the `/api/md` mirror) | — | — | "Guaranteed Leads" / "guaranteed lead generation services" (2x) |

No two of these six surfaces agree on both founding date and location at once. An LLM building a
grounded entity card from crawled Vierra content today would plausibly output "founded 2019 in
New York" (live llms.txt), or "founded 2024 in Cambridge" (redesign llms.txt), or blend the two.
This is the single highest-leverage fix available — it directly determines whether AI answer
engines can state basic facts about Vierra correctly.

---

## 1. Findings table

| Issue | Severity | Evidence | Recommendation |
|---|---|---|---|
| Live llms.txt disagrees with schema AND with the redesign-branch llms.txt on founding year (2019 vs 2024) and city (NYC vs Cambridge) | Critical | See table above | Pick ONE canonical NAP + founding date, write it once, reference it everywhere (llms.txt, JSON-LD ×3, FAQ, JobPosting, careers copy). Deploy the redesign branch's llms.txt only after this reconciliation — don't ship a third conflicting version. |
| `content/md/index.md` (served at `/api/md`, explicitly a machine-readable mirror for AI) still pitches "Guaranteed Leads" / "guaranteed lead generation services" twice, contradicting the new "Risk-Averse Lead Engine" positioning and the FAQ's already-updated "risk-averse" (not "guaranteed") framing | High | `content/md/index.md` lines 1–13 | Rewrite to match the FAQ's current risk-averse framing; this file is a *higher*-trust AI input than normal HTML because it's presented as a clean machine feed — errors here propagate with more authority. |
| `pages/careers/[slug].tsx` JobPosting schema hardcodes `addressLocality: 'New York'` while every other schema surface says Cambridge, MA | Medium | `pages/careers/[slug].tsx` lines 126-130 | Either give the JobPosting schema a real remote/hybrid `jobLocationType` + Cambridge HQ, or if NYC is a genuine second office, add it consistently to Organization `sameAs`/`location` array and the FAQ, not just careers. |
| FAQ answer to "Where is Vierra located?" mentions a NYC office that appears nowhere else except careers copy — reads as ad hoc rather than a maintained fact | Medium | `lib/faq.ts` line 48 | Confirm whether a NYC office is real. If yes, add it to Organization schema `location`/`department`. If no, remove from both FAQ and careers. |
| Numeric proof stats ("500k+ campaigns," "175+ businesses supercharged") only exist in a client-side rotating card (`StatsGrid.tsx`) — SSR/initial paint shows only "150M+ leads generated," the other two values are written into the DOM by a `setInterval` state cycle | High | `components/BusinessSection/StatsGrid.tsx` lines 52-69, 192-209 | These are exactly the kind of citable, source-attributable statistics AI Overviews/Perplexity like to quote — but a crawler snapshot only ever captures one of three. Render all three as static, visually-stacked or `sr-only`-duplicated text so all values are always in the DOM, with the counter animation as pure visual enhancement over already-present text. |
| No dedicated definitional/glossary page for "risk-averse lead generation," "B2B lead generation agency," or the onboarding process — these phrases exist only inside marketing copy, never as a standalone, linkable, question-headed passage | High | No glossary/methodology/comparison pages found under `pages/` (grep clean) | See Content Gaps (§6) — this is the biggest single opportunity for AI Overview / ChatGPT citation on Vierra's own category-defining term. |
| FAQ answers are well-formed (40-60 words, self-contained per the file's own doc-comment) but several bury the direct answer after a subordinate clause rather than leading with it | Low-Medium | e.g. `lib/faq.ts` line 23 leads with "We combine warm outreach..." rather than stating the mechanism-then-benefit in one crisp sentence first | See rewrites in §3. |
| sr-only "About Vierra" block on the homepage is good practice (keeps a definition in the DOM for a section that is otherwise all animation/visual) but is generic boilerplate, not optimized as an extractable one-sentence definition + supporting sentence | Medium | `app/page.tsx` lines 177-186 | Rewrite as: definition sentence (what + who + differentiator) then one mechanism sentence. See §3. |
| Blog posts (`pages/blog/[slug].tsx`) have strong schema (BlogPosting, BreadcrumbList, author `sameAs` via `lib/authorProfiles.ts`, publisher, `dateModified`) — a real AEO strength | Positive | lines 111-182 | Extend `AUTHOR_LINKEDIN` map — currently only 2 authors have `sameAs`; any post by an author not in that map silently loses the E-E-A-T signal (`authorSameAs` returns `undefined`). Audit all blog authors against this map. |
| Blog content body is raw HTML from a CMS/DB (`lib/blog.ts` → Prisma `content: string`, injected via `dangerouslySetInnerHTML`) with no enforced structural convention (no guarantee of question-form H2s, direct-answer-first paragraphs, or passage length) | Medium | `lib/blog.ts`, `pages/blog/[slug].tsx` line 354 | Editorial checklist, not code fix: each H2 should be a question or direct claim, followed immediately by a 40-60 word (FAQ-style) or 134-167 word (long-form) self-contained answer before any elaboration. |
| llms.txt (both versions) is a flat key-value file, not aligned to the emerging llms.txt convention (H1 name + one-line summary, then Markdown H2 sections with linked pages, in the style popularized by Answer.AI / llmstxt.org) | Medium | Both `public/llms.txt` and live version use a custom `Key: value` schema instead of Markdown links | Restructure per §4 skeleton — the convention increasingly expected is a **Markdown document**, not a headers-style manifest, so it can be read directly as page content, not just parsed as metadata. |

---

## 2. Citability Score: 58 / 100

Scored on passage-level extractability (self-contained, direct-answer-first, correctly-sized,
consistently present in server-rendered DOM):

| Sub-signal | Score | Notes |
|---|---|---|
| Answer length discipline (target 40-167 words) | 8/10 | FAQ answers correctly sized; blog posts unaudited/uncontrolled since content is freeform HTML from CMS. |
| Direct-answer-first structure | 5/10 | Several FAQ answers lead with mechanism/process before the direct claim (see §3). sr-only block is generic, not answer-first. |
| Question-form headings | 6/10 | FAQ H2s are properly question-form (good — confirmed live). No question-form H2s anywhere else on the site (homepage, blog H2s are topic labels per CMS content, not verified as questions). |
| Self-contained (no pronouns/context needed) | 7/10 | FAQ mostly self-contained. sr-only block ties "our" without ever anchoring the antecedent noun in the same sentence it's extracted from. |
| Consistent DOM presence (not client-only) | 3/10 | Stats, testimonials, and channel-tab copy render only ONE rotated variant in the initial/any single DOM snapshot — the single biggest citability tax on this codebase. |
| Specific, sourced statistics | 6/10 | Good raw numbers ($15M+, 250% ROI, 150M+ leads) exist but have no source/methodology attribution ("per client survey," "trailing 12mo," etc.) — AI engines discount unsourced superlatives. |
| Definitional/glossary coverage of category terms | 2/10 | No standalone page defines "risk-averse lead generation" or "B2B lead generation agency" — see §6. |

**Net: 58/100** — solid FAQ foundations, but held down by (a) content that literally isn't in
the DOM at snapshot time, (b) no definitional anchor content for the category terms the business
wants to own, and (c) answer-first phrasing not yet applied outside the FAQ.

---

## 3. Example rewrites (AI-quotable form)

### 3a. FAQ — "How does Vierra's lead generation work?"

**Current** (`lib/faq.ts` line 23):
> "We combine warm outreach through our network, results-based targeted ad campaigns, and
> automated client-acquisition systems, then use analytics to continuously improve conversions.
> The result is a predictable pipeline of qualified leads rather than one-off campaigns that stop
> working the moment you stop paying."

Leads with the mechanism list before stating the outcome — an AI answer engine quoting the first
sentence in isolation returns a list, not an answer.

**Rewrite:**
> "Vierra's lead generation works by combining warm network outreach, results-based paid ad
> campaigns, and automated client-acquisition systems into one system, then using analytics to
> continuously raise conversion rates. This produces a predictable, ongoing pipeline of qualified
> leads — unlike one-off campaigns that stop producing the moment you stop paying for them."

Same information, but the first clause now states the claim ("works by combining X, Y, Z"),
making sentence one alone a complete, quotable answer.

### 3b. Homepage sr-only "About Vierra" block

**Current** (`app/page.tsx` lines 177-186):
> "Vierra is a B2B lead generation platform that helps businesses build a funnel, research leads,
> capture buying signals, and schedule meetings autonomously. Our case-study-proven, results-based
> systems help businesses increase ROI and conversions, scale efficiently, and fill their sales
> calendars with qualified leads."

Two sentences, both list-heavy, no single sentence stands alone as a definition an engine could
cite for "what is Vierra."

**Rewrite:**
> "Vierra is a risk-averse, B2B lead generation agency based in [canonical city] that builds
> case-study-proven systems — warm outreach, targeted paid ads, and automated acquisition — to
> fill a client's sales calendar with qualified leads without speculative ad spend. Vierra's
> platform also researches leads, captures buying signals, and schedules meetings autonomously,
> so results scale without added headcount."

Sentence one is now a complete, citable definition (who + category + differentiator + mechanism);
sentence two is the supporting detail. This is the sentence Google AI Overviews / ChatGPT would
most likely lift verbatim for a "what is Vierra" or "what is risk-averse lead generation" query —
which is exactly why it needs the canonical location filled in once NAP is reconciled (§0).

### 3c. New definitional passage for "what is risk-averse lead generation" (currently unanswered anywhere on-site)

Recommend adding this as a standalone, linkable passage — ideally its own glossary entry or the
opening paragraph of a pillar blog post, with the phrase itself as an `<h2>`:

> **What is risk-averse lead generation?**
> Risk-averse lead generation is a B2B marketing model that ties spend to case-study-proven,
> measurable results rather than speculative ad budgets. Instead of paying for impressions or
> clicks upfront, a business only scales spend on channels already shown to convert into paying
> clients — eliminating wasted spend on unproven campaigns and maximizing return on ad spend.
> Vierra uses this model to combine warm outreach, targeted ads, and automated acquisition systems
> into a single, measurable pipeline.

145 words — inside the 134-167-word optimal-citation band, direct-answer-first, and gives AI
engines a clean, source-attributable definition to quote with Vierra named as the originator.

---

## 4. llms.txt: convention gap and corrected skeleton

**Current format problem:** both the live and repo versions use a flat `Key: value` header
format. This isn't the direction the llms.txt convention (llmstxt.org / Answer.AI proposal, now
the most common pattern AI crawlers look for) has settled on. That convention is a **Markdown
document**: H1 = site/product name, one-line blockquote summary, then H2 sections of Markdown
links to canonical pages (optionally with one-line descriptions), so the file is useful both as
metadata AND as directly-readable page content. The current key-value format is parseable but
not directly citable as prose, and — as shown in §0 — the two existing copies have already
drifted out of sync with each other and with schema, which a single Markdown source of truth
would make far less likely (one file, human-readably diffable against site copy).

**Freshness:** repo version claims `Last-Modified: 2026-06-18` / `Version: 1.1`, but its content
(2024 founding, "Guaranteed Leads") is stale relative to both the schema (2019) and the FAQ
(risk-averse, not guaranteed) already in the same repo — the version bump did not correspond to
an actual content reconciliation.

**Recommended corrected skeleton:**

```markdown
# Vierra

> Risk-averse B2B lead generation agency. Vierra builds case-study-proven, results-based
> systems — warm outreach, targeted paid ads, and automated acquisition — that fill a client's
> sales calendar with qualified leads without speculative ad spend. Founded [YEAR], headquartered
> in [CANONICAL CITY, STATE].

## Company
- Legal name: Vierra Digital LLC
- Founded: [YEAR — reconcile with schema]
- Headquarters: [CANONICAL ADDRESS — reconcile with schema + careers]
- Contact: alex@vierradev.com · +1-339-333-0929

## Key pages
- [Homepage](https://vierradev.com): overview of the risk-averse lead engine model.
- [FAQ](https://vierradev.com/faq): direct answers on services, pricing model, onboarding, and location.
- [Blog](https://vierradev.com/blog): lead-generation strategy, B2B marketing, and case studies.
- [Careers](https://vierradev.com/careers): open roles and hiring locations.

## What Vierra does
- Warm outreach through an existing partner/referral network.
- Results-based, targeted paid ad campaigns optimized for return on ad spend.
- Automated client- and partner-acquisition systems.
- Analytics-driven optimization of the full funnel.

## Who Vierra serves
Small and large B2B businesses across service and product industries seeking a predictable,
scalable pipeline of qualified leads, from local service businesses to multi-location companies.

## Full content
- [Markdown mirror index](https://vierradev.com/api/md): machine-readable copy of key pages.
- [Sitemap](https://vierradev.com/sitemap.xml)

## Last updated
[DATE] — regenerate whenever founding date, location, or positioning language changes anywhere
in schema.org markup, the FAQ, or homepage copy, to keep this file as the single reconciled
source of truth rather than a fourth independent record.
```

---

## 5. Platform-specific notes

| Platform | What it rewards | Where Vierra is weak |
|---|---|---|
| **Google AI Overviews** | Passage-level extraction from well-structured HTML, schema.org corroboration (FAQPage, Organization, BreadcrumbList), consistent NAP for local/entity panels | NAP conflict (§0) directly undermines the knowledge-panel-style entity grounding AIO leans on; rotated-only stats reduce the pool of extractable passages. |
| **ChatGPT Search / OAI-SearchBot** | Clean crawlable text (`GPTBot`/`OAI-SearchBot` explicitly allowed — good), authoritative third-party corroboration (Wikipedia, Reddit, YouTube — per the correlation data, YouTube mentions are the strongest predictor), llms.txt as a trust signal | No evidence of YouTube presence, Reddit presence, or Wikipedia entity found in any surface reviewed (blog, schema `sameAs`, llms.txt social list) — `sameAs` only lists LinkedIn/Instagram/Facebook/X, none of the higher-correlation platforms. |
| **Perplexity** | Recency signals (dateModified, fresh blog cadence), direct citation-friendly sentences, source diversity | Blog has good `dateModified`/ISR (5-min revalidate) — a strength. But definitional gap (§6) means Perplexity has no Vierra-authored passage to cite for the category terms themselves, so it will cite competitors or generic sources instead. |
| **Bing Copilot** | Bing Webmaster verification, schema.org depth, IndexNow/freshness | `verification.google` present in `app/layout.tsx` metadata but no visible Bing verification meta tag; schema depth is otherwise strong (Organization + LocalBusiness + WebSite + BreadcrumbList + BlogPosting all present) — this is a quick add, not a structural gap. |

---

## 6. Content gaps (informational content AI engines need to cite Vierra as a source)

1. **Category glossary / definition page** — no standalone answer for "what is risk-averse lead
   generation," "what is a B2B lead generation agency," or "guaranteed vs risk-averse lead
   generation" (the exact positioning pivot the redesign is making). This is the single highest-
   value content gap: Vierra coined/owns "risk-averse lead engine" as positioning language but has
   not published a citable definition of it anywhere crawlable.
2. **Methodology explainer** — "How does lead generation onboarding work?" is answered in one
   FAQ sentence ("Onboarding is fast and simple...") with no step-by-step breakdown. A dedicated
   page/section with a numbered, question-headed process (Step 1: audit call → Step 2: system
   setup → Step 3: launch → Step 4: optimization) would be directly liftable as a numbered-list
   answer box for "how does lead generation onboarding work."
3. **Comparison content** — nothing found addressing "Vierra vs [agency model]" or "guaranteed
   leads vs risk-averse leads" even though this contrast is core to the new positioning. AI
   engines answering comparison-style queries need a page that names both sides of the comparison
   explicitly.
4. **Case-study detail pages** — testimonials/case studies are referenced (Salon Renee, Somerville
   Dental, Deanna Mazzeo, etc.) but only as short quotes in a rotating component, not as full,
   linkable, dated case-study pages with quantified before/after numbers — the format AI Overviews
   most readily cite for "results" queries.
5. **Third-party entity presence** — no Wikipedia, Reddit, or YouTube presence identified. Per the
   brand-mention correlation data, YouTube is the strongest predictor (~0.737) of AI citation
   likelihood; Vierra's `sameAs` array and llms.txt social list have none of Reddit/YouTube/
   Wikipedia. This is a business-development gap, not just a technical one, but it materially caps
   ChatGPT/Perplexity citation likelihood regardless of on-site fixes.

---

## Summary of top fixes by impact vs effort

| Fix | Impact | Effort |
|---|---|---|
| Reconcile founding year + address across live llms.txt, repo llms.txt, JSON-LD ×3, FAQ, careers JobPosting | Critical | Low (content edit, no code) |
| Rewrite `content/md/index.md` to drop "Guaranteed Leads" framing, match FAQ's risk-averse positioning | High | Low |
| Make all rotated stat/testimonial/channel values statically present in DOM (visually rotate, don't remove from markup) | High | Medium |
| Publish a glossary/definition page for "risk-averse lead generation" and related category terms | High | Medium |
| Convert llms.txt to Markdown-doc convention per §4 skeleton | Medium | Low |
| Expand `AUTHOR_LINKEDIN` map coverage; add Bing Webmaster verification meta tag | Low-Medium | Low |


---



<br>

# PART III — Search Experience Optimization (SXO)

<sub>Source file: `vierradev.com-audit/findings/sxo.md`</sub>


---

# SXO Analysis: vierradev.com Homepage (homepage-redesign branch, not yet live)

Note on scope: the redesigned homepage lives only in source (`app/page.tsx` + `components/`)
on branch `homepage-redesign` and is not deployed, so it was analyzed directly from source
rather than fetched/rendered live. SERP analysis used WebSearch + page-structure fetches of
top-ranking competitor pages for the core commercial queries below.

## Target Keywords Analyzed
"B2B lead generation agency", "lead generation services", "outbound marketing agency",
"appointment setting service"

---

## 1. SXO Gap Score: 46/100 (separate from the site's SEO Health Score of 81)

The site is technically healthy (per the parallel SEO audit) but the homepage is the
**wrong page type** for the commercial keywords it's trying to win, and it is the *only*
page trying to win them -- there is no dedicated service, pricing, or case-study page to
absorb bottom-funnel intent.

---

## 2. Page-Type Mismatch: HIGH

**SERP dominant type for all 4 queries: Service Page / Hybrid Service Page**
(confidence: ~80% -- 8 of 10 evidence pages across the 4 SERPs follow this pattern)

Evidence from top-ranking pages fetched directly (Belkins, SalesRoads, Callbox):
- **Belkins**: named case studies with hard numbers ("330 booked appointments in 15
  months", "$434K forecasted revenue"), a 6-role team breakdown ("Meet the team behind
  your project"), explicit process stages, client logo wall, dual CTA ("Get a quote" /
  "Book a call").
- **SalesRoads**: visible starting price ("$9,950 for 4 weeks, retainer basis"), named
  case studies (Parker Hannifin, AchieveIt -- "$27M pipeline generated"), explicit
  risk-reversal ("Cancel anytime. No commitments."), 4-step process.
- **Callbox**: dedicated `/lead-generation-pricing/` page, 4 video case-study
  testimonials with client names/industries, "3x average pipeline growth within 90
  days," FAQ section, 4-step process.

**Vierra's homepage classifies as: Landing Page / Hybrid**, per
`page-type-taxonomy.md` (single value prop hero, one CTA style repeated, minimal nav,
feature-grid mixed with light process content) -- it is missing the case-study depth,
pricing signals, and named team-credential detail that the SERP consistently rewards.

**Impact**: A visitor arriving from a "B2B lead generation agency" or "appointment
setting service" search lands on a page structurally closer to a SaaS landing page than
to the service-page format Google and top competitors have converged on. Google itself
is unlikely to distinguish this over time (ranking impact), and *human* visitors bounce
because the proof/pricing/process depth they've been trained to expect by every
competitor result isn't there.

### Page-Type Gap Matrix

| Query | SERP-Rewarded Page Type | Does Vierra Have This Page? | Gap |
|---|---|---|---|
| "B2B lead generation agency" | Service Page (process + named case studies + team + client logos) | No -- homepage only, case-studies section is a "Coming Soon" placeholder (`components/WorkSection/CaseStudies.tsx:61-63`) | CRITICAL |
| "lead generation services" | Service/Hybrid Page with visible pricing or pricing link | No -- no `/pricing` route anywhere in `app/` or `pages/`; only a "Let's Talk" modal that collects revenue data instead of disclosing price | CRITICAL |
| "outbound marketing agency" | Service Page with channel-by-channel breakdown + process steps | Partial -- `FeaturesV2` ("Your Entire GTM On Autopilot") lists channels/capabilities but as a feature-grid, not a service/methodology narrative with proof per channel | HIGH |
| "appointment setting service" | Service Page or comparison content addressing cost models ($150-500/meeting or $3k-12k/mo retainers per SERP) | No -- Vierra's only pricing-adjacent content is "You Get Paid First" (`Tailored.tsx:224-227`), a performance-based claim never explained in mechanics, minimums, or contract terms | HIGH |
| (all 4) | FAQ schema / FAQ section addressing cost, guarantee, process, timeline | Partial -- a real FAQ exists (`lib/faq.ts`, 8 Q&As including the actual "risk-averse" and pricing explanation) but it lives on a separate `/faq` page not linked in main nav (only in footer) and not referenced from the homepage at all | MEDIUM |

**Primary recommendation**: build a dedicated Service Page (e.g. `/lead-generation` or
`/services`) that carries the process/case-study/team depth the SERP rewards, and let
the homepage stay a lighter-touch brand/overview page linking into it -- rather than
asking one landing page to do both jobs.

---

## 3. User Stories (derived from SERP signals)

1. As a **budget-conscious scaling founder**, I want to know what this will cost before
   I hand over my phone number, because I've already seen SalesRoads publish "$9,950/4
   weeks" and Callbox link straight to a pricing page, but I'm blocked by **price
   opacity** -- Vierra's only path to any cost information is completing 2 steps of a
   lead-capture form.
   *(Source: SalesRoads/Callbox pricing transparency; Vierra's `Modal.tsx` requires
   `monthlyRevenue`/`desiredRevenue` before any pricing is disclosed)*

2. As a **marketing director comparison-shopping agencies**, I want to see named
   client results with numbers (bookings, pipeline value, timeframe), because every
   competitor result front-loads exactly that, but I'm blocked by Vierra's case-studies
   section literally reading "Coming Soon."
   *(Source: Belkins "330 booked appointments in 15 months"; SalesRoads "$27M pipeline
   generated"; Vierra `CaseStudies.tsx:61-63`)*

3. As a **skeptical CFO evaluating a "risk-averse" claim**, I want to understand the
   actual guarantee mechanics (what "risk-averse" and "you get paid first" mean
   contractually), because SalesRoads explicitly states "Cancel anytime, no
   commitments" as its risk-reversal, but I'm blocked -- Vierra's homepage never
   defines the claim; the only definition ("You only pay for the leads who convert to
   high-paying clients") lives in `lib/faq.ts`, on a page not linked from the homepage
   or main nav.
   *(Source: competitor risk-reversal framing vs. Vierra's undefined "Risk-Averse Lead
   Engine" H1 + `Tailored.tsx` "You Get Paid First" step with no terms)*

4. As a **technical evaluator assessing fit for my industry**, I want proof Vierra
   works with companies like mine, because Belkins and Callbox segment by industry
   expertise, but I'm blocked by mixed signals -- the homepage hero says "B2B Lead
   Generation" while the visible testimonials are largely local/SMB service
   businesses (yoga studio, dental office, hair salon) rather than B2B companies.
   *(Source: Callbox "Industry Expertise" section; Vierra `Testimonials.tsx:36-58`
   -- Qigong Infused Yoga, Somerville Dental, Salon Renee alongside genuine B2B logos)*

5. As an **enterprise/mid-market buyer wanting a fast initial signal**, I want a clear
   process overview and quick next step appropriate to my stage, because Callbox and
   SalesRoads both expose a numbered 4-step process before any form, but I'm blocked by
   a single, undifferentiated "Let's Talk" CTA that starts a 3-step qualification form
   regardless of whether I'm in awareness or decision stage.
   *(Source: Callbox 4-step "Define ICP > Build & Enrich Data > Multi-Channel Outreach
   > Deliver Qualified Leads"; Vierra `Modal.tsx` single-path 3-step form)*

Journey stages covered: Awareness (#4, #5), Consideration (#1, #2), Decision (#3).

---

## 4. Persona Scoring

| Persona | Relevance | Clarity | Trust | Action | Total | Rating |
|---|---|---|---|---|---|---|
| Scaling B2B Founder (wants pipeline fast, evaluating agencies) | 18/25 | 14/25 | 10/25 | 15/25 | 57/100 | Needs Work |
| Marketing Director (comparison-shopping, needs proof + process) | 15/25 | 12/25 | 8/25 | 14/25 | 49/100 | Needs Work |
| Skeptical CFO (evaluating "risk-averse"/guarantee claim, needs pricing + terms) | 12/25 | 8/25 | 6/25 | 10/25 | 36/100 | Critical Mismatch |

### Persona Cards

**Scaling B2B Founder** -- wants a fast, credible path to more booked meetings
- Journey stage: Consideration
- Key questions: "What exactly do you do for me?" "How fast can I see results?" "Who
  else like me have you helped?"
- Score notes: Relevance is decent (hero + `FeaturesV2` cover the offer clearly).
  Clarity suffers because the real proof (case studies) is a placeholder, so the
  founder must take capability claims on faith. Trust is weak -- testimonials mix
  in unrelated small-local-business types. Action is single-path ("Let's Talk" only).

**Marketing Director** -- comparison-shopping multiple agencies before recommending one
- Journey stage: Consideration/Decision
- Key questions: "How does your process compare to [Belkins/Callbox]?" "What's the
  contract structure?" "Do you have case studies in my industry?"
- Score notes: Lowest Trust score of the three -- no client logos with outcomes, no
  visible team credentials/tenure (Team section shows names/roles/photos only, no
  bios or years of experience, unlike Belkins' explicit "6-role team" breakdown).

**Skeptical CFO** -- evaluating the "Risk-Averse Lead Engine" claim for legitimacy
- Journey stage: Decision
- Key questions: "What does 'risk-averse' actually mean contractually?" "What am I
  billed and when?" "What happens if it doesn't work?"
- Score notes: Critical Mismatch. The homepage's single boldest brand claim
  ("Risk-Averse Lead Engine") is never substantiated on the page it headlines --
  the actual mechanism ("You only pay for the leads who convert to high-paying
  clients," per `lib/faq.ts:26-29`) is one click away on `/faq`, itself only linked
  from the footer. A financially cautious buyer has no way to verify the central
  claim without first surrendering contact + revenue data via the modal.

### Weakest Persona: Skeptical CFO (36/100)
**Top issue:** The page's core value proposition is an unexplained guarantee claim.
**Recommended fix:** Add a "How Risk-Averse Works" section directly below the hero (or
inline in `Tailored.tsx`'s "You Get Paid First" card) that states the actual terms in
plain language, linking out to `/faq#risk-averse` for the full explanation -- do not
require form submission to learn what the headline claim means.

### Systemic Issues
- **Trust** is the lowest-scoring dimension across all three personas (avg 8/25):
  driven by the case-studies placeholder, unexplained guarantee claim, and thin team
  bios.
- **Action** is uniformly mediocre (avg 13/25): one CTA style ("Let's Talk" modal) for
  every journey stage and persona, with no lower-friction alternative (e.g., pricing
  page, self-serve calculator, case-study download).

### Priority Actions
1. Replace the "Coming Soon" case-studies placeholder with 2-3 named, numbered case
   studies (client, industry, timeframe, result) -- fixes Trust for all three personas.
2. Add a plain-language "how risk-averse pricing works" explainer on the homepage
   itself, sourced from the existing `lib/faq.ts` copy -- fixes the CFO's Critical
   Mismatch.
3. Diversify or segment testimonials so B2B buyers see B2B-relevant proof (the local
   SMB testimonials can stay, but should be labeled/segmented rather than mixed in
   with B2B claims).

---

## 5. Conversion Path / Friction Analysis

**Current state**: The homepage has exactly one conversion mechanism -- a "Let's Talk"
button (`app/page.tsx:188-197`) that opens a 3-step modal (`components/Modal.tsx`).

| Friction point | Detail | Why it matters |
|---|---|---|
| No pricing disclosed anywhere pre-form | No `/pricing` route exists in `app/` or `pages/`; price only implied by the modal's own revenue-range questions | 2 of 4 SERP leaders (SalesRoads, Callbox) show a number or a dedicated pricing page before asking for contact info; buyers use price as a first-pass qualifier |
| High-commitment first CTA | Modal step 1 requires full name, email, **and validated 10-digit phone number** before any information is given back | No lower-friction option (e.g., "See pricing," "Read a case study," "See how it works") exists for early-stage visitors -- everyone is funneled into a sales-qualification form |
| Guarantee claim precedes its own explanation | Hero H1 leads with "Risk-Averse Lead Engine" but the mechanism is defined only in `lib/faq.ts`, a page not linked from the homepage | Buyers must trust an unexplained claim or dig through the footer to `/faq` to find the actual terms -- most will not look |
| Case-studies section is a non-functional placeholder | `components/WorkSection/CaseStudies.tsx:43-64` renders a "Coming Soon" play-button mockup under the heading "Flood Your Sales Calendar" / "See It In Action" | This section sits exactly where competitor pages place their strongest trust asset (named case studies); currently it actively signals "not ready" |
| No FAQ presence on the homepage | FAQ page (`pages/faq.tsx`) exists with genuinely good content (8 Q&As covering pricing model, timeline, ICP fit) but is linked only from the footer, not the main nav (`Header.tsx`) or homepage body | Competitor SERPs (Callbox) surface FAQ directly on the ranking page; Vierra's best objection-handling content is effectively hidden from homepage visitors |
| Single CTA style regardless of journey stage | Every section (hero, footer CTA "Want To Explode Profits?", etc.) drives to the same modal | Awareness-stage visitors (just researching) and decision-stage visitors (ready to buy) get identical, high-commitment friction |

**What is not friction**: the modal's form UX itself is well-built (inline validation,
phone formatting, progress bar, clear step titles) -- the problem is what precedes it
(no pricing/proof context) and that it's the *only* path offered.

---

## 6. Funnel / Content Gap Recommendations (prioritized)

1. **Build a dedicated Service Page** (`/lead-generation` or `/services`) matching the
   SERP-rewarded Service Page format: process steps, named case studies with numbers,
   team credentials, and either a price anchor or a link to pricing. Cross-reference:
   thin/placeholder content also flagged in the parallel content audit -- recommend
   `/seo content` for a deeper E-E-A-T pass on this new page once drafted.
2. **Ship a pricing/how-it-works page** (or clearly labeled pricing section) that
   states the "You Get Paid First" / risk-averse mechanics in plain terms before any
   form is required. This directly targets the CFO persona's Critical Mismatch score.
3. **Replace the "Coming Soon" case-studies placeholder** with real, named results
   (even 2-3 to start) -- this is the single highest-leverage fix, as it improves
   Trust for all three personas and the page-type match simultaneously.
4. **Surface the FAQ on/near the homepage** (e.g., an FAQ accordion above the footer,
   or at minimum a main-nav link) so the objection-handling content already written in
   `lib/faq.ts` actually reaches homepage visitors instead of living behind a
   footer-only link.
5. **Add a secondary, lower-friction CTA** for awareness-stage visitors (e.g., "See a
   case study," "How pricing works") alongside "Let's Talk," so the funnel isn't
   single-path for every persona and journey stage.
6. **Segment testimonials by audience** so B2B-relevant proof is visually distinct
   from the local-SMB testimonials, avoiding the mixed-signal problem for the
   Marketing Director persona.

Cross-skill references: missing/placeholder case studies and the undefined
"risk-averse" claim both point to `/seo content` for a full E-E-A-T-focused pass;
the absence of pricing/service schema on any page points to `/seo schema` once a
Service Page is built.

---

## 7. Limitations

- The redesigned homepage is unreleased (branch `homepage-redesign`), so it was
  analyzed from source (`app/page.tsx` + `components/`) rather than via
  `scripts/render_page.py` live rendering, per the task's explicit instruction --
  live above-the-fold rendering, real Core Web Vitals, and actual mobile layout could
  not be verified this way.
- Competitor page structures (Belkins, SalesRoads, Callbox) were fetched directly via
  WebFetch rather than through a live Google SERP scrape; SERP features (PAA boxes,
  featured snippets, ads, AI Overview) for the 4 target queries were not captured in
  structured form and are inferred from WebSearch summaries only -- no DataForSEO
  access was available for precise SERP feature/position data.
- No GSC/GA4/CrUX data was available to confirm current keyword rankings or actual
  bounce/conversion behavior on the live site for these queries.
- Persona scores are qualitative judgments against the stated rubric, not derived from
  user testing or analytics.


---



<br>

# PART IV — Local SEO & NAP

<sub>Source file: `vierradev.com-audit/findings/local.md`</sub>


---

# Local SEO Findings — vierradev.com

Scope: NAP consistency, LocalBusiness/schema entity modeling, GBP/citation/review signal
assessment from public source code and live-page evidence, and local-content relevance for
Vierra, a national B2B lead-generation agency headquartered (per most surfaces) in Cambridge, MA.

Business type detected: **Hybrid / ambiguous** — schema and legal footer present a
brick-and-mortar-flavored `LocalBusiness` entity (address, geo, opening hours, price range),
while the actual go-to-market (FAQ copy, careers pages, testimonials) describes a
**nationally-operating, remote-friendly B2B service business (SAB-like)** with no walk-in
storefront, no Maps embed, and no local-pack-style content.

Industry vertical: **Professional/B2B Services — digital marketing & lead generation
agency.** None of the six reference verticals (restaurant, healthcare, legal, home services,
real estate, automotive) apply directly; closest schema.org fit is `ProfessionalService`
(already used) rather than a vertical-specific subtype.

---

## 1. Canonical NAP Decision (read this first)

**Recommendation: Cambridge, MA 02138 is the canonical NAP.** It is the address used in the
site-wide `Organization` schema, the `LocalBusiness`/`ProfessionalService` schema, the
`geo.region`/`geo.placename`/`ICBM` meta tags, and the legal contact blocks on the Terms of
Service and Privacy Policy pages (`app/layout.tsx`, `pages/terms-of-service.tsx:493`,
`pages/privacy-policy.tsx:505`). This is the most consistent, most "official-document-adjacent"
address in the codebase and the one most likely tied to the actual LLC registration, so it
should be treated as ground truth and every other surface should be conformed to it — **not**
the reverse.

New York should **not** be encoded as a second official business address unless Vierra
genuinely leases/staffs an independently-addressable NYC office capable of receiving a Google
Business Profile verification (postcard/video) separate from Cambridge. Given the
`Organization` schema's own `numberOfEmployees` claim (5–10 people), running two verified GBP
listings is unrealistic and risks a Business Profile suspension for duplicate/ineligible
locations. If NYC is real, it should be modeled as a `subOrganization`/`department` `Place`
with its own accurate street address — never as a bare `addressLocality: "New York"` with no
street, which is what exists today.

**Every surface below must be reconciled to Cambridge, MA 02138 / +1‑339‑333‑0929 /
founded 2019** (or, if the business truly wants to reposition as NYC-based going forward, the
decision must be reversed everywhere at once — the failure mode to avoid is the current
half-migrated state where different files disagree).

### NAP / entity source comparison

| Surface | Location claim | Founded | Phone | Notes |
|---|---|---|---|---|
| `app/layout.tsx` — `Organization` schema | Cambridge, MA 02138 | 2019 | +1‑339‑333‑0929 | canonical candidate |
| `app/layout.tsx` — `LocalBusiness`/`ProfessionalService` schema | Cambridge, MA 02138 (geo 42.3736/-71.1097) | 2019 | +1‑339‑333‑0929 | canonical candidate |
| `app/layout.tsx` meta (`geo.region`, `geo.placename`, `ICBM`) | Cambridge, Massachusetts | — | — | consistent with schema |
| `pages/terms-of-service.tsx:493`, `pages/privacy-policy.tsx:505` (legal contact) | Cambridge, MA 02138 | — | +1‑339‑333‑0929 | consistent with schema |
| **LIVE** `vierradev.com/llms.txt` (production, master branch) | **New York, NY 10001** | **2019** | — | conflicts with schema location; confirmed live |
| Branch `public/llms.txt` (this branch, unreleased) | Cambridge, MA 02138 | **2024** | +1‑339‑333‑0929 | fixes location but *regresses* founding year vs. schema |
| **LIVE** `lib/faq.ts` "Where is Vierra located?" (production, master branch, confirmed via `git show master:lib/faq.ts`) | **"based in New York, NY"** | — | — | user-facing FAQ answer + `FAQPage` JSON-LD both say NY |
| Branch `lib/faq.ts` (this branch, commit `ec026c9`, unreleased) | "based in Cambridge, Massachusetts **with a NYC office**" | — | — | introduces a third, hybrid narrative not matched anywhere else |
| `lib/careers.ts` (`CAREERS_LOCATION = 'In-Person NYC'`) + `pages/careers/[slug].tsx` `JobPosting.jobLocation` | New York, NY (city/region only, no street address) | — | — | every job listing, all copy ("hybrid NYC schedule" ×7) is NYC-only, zero Cambridge mention |
| `pages/careers.tsx` meta description/keywords | "NYC-based roles", "NYC tech jobs" | — | — | reinforces NYC-only narrative |

**Read on this table:** the codebase is mid-migration. Schema/meta/legal-footer already point
to Cambridge (live). The branch is *partially* continuing that migration in `llms.txt`
(NY→Cambridge, good) but simultaneously breaking the founding date (2019→2024, bad) and
introducing a FAQ answer that contradicts both the live FAQ (pure NY) and the careers section
(pure NY, no Cambridge at all). If this branch merges as-is, the conflict count goes from
"2 competing locations" to "3 competing narratives across 5+ surfaces," which is strictly
worse for AI-answer engines and Google's entity resolution than the current live state.

---

## 2. NAP Consistency & Citations Findings

| Issue | Severity | Evidence | Recommendation |
|---|---|---|---|
| Live production identity (`llms.txt`, FAQ page/`FAQPage` schema) says New York, NY while all structured `LocalBusiness`/`Organization` schema says Cambridge, MA | **Critical** | Live fetch of `vierradev.com/llms.txt`; `git show master:lib/faq.ts` → "based in New York, NY" vs. `app/layout.tsx` LocalBusiness address = Cambridge | Pick Cambridge as canonical (see §1) and update the live FAQ answer and `llms.txt` in the same deploy that ships this branch. Do not ship the branch's Cambridge/2024 llms.txt without also fixing founding date and FAQ copy together. |
| Founding date conflict: schema says 2019 everywhere except branch `llms.txt` (2024) | **High** | `app/layout.tsx` `foundingDate: "2019"` (Organization + LocalBusiness) vs. `public/llms.txt:16` `Founded: 2024` (this branch) vs. live `llms.txt` `Founded: 2019` (confirmed) | This is a regression about to go live. Fix `public/llms.txt` to `2019` before merge — an LLM/AI-answer engine reading llms.txt today would cite "founded 2024," directly contradicting the schema.org `foundingDate` on every page. |
| Careers section (JobPosting schema + all 7 job listings + careers meta) is 100% New York with zero reference to the Cambridge HQ | **High** | `pages/careers/[slug].tsx:124-132` `jobLocation.address.addressLocality: "New York"`; `lib/careers.ts:28` `CAREERS_LOCATION = 'In-Person NYC'`; `pages/careers.tsx` meta keywords "NYC tech jobs" | If Cambridge is canonical, either (a) correct all job postings to Cambridge, MA if hires actually work in Cambridge, or (b) if NYC is a real, separate staffed office, give it a full accurate address and reconcile it as a documented second location rather than an undocumented one. Current state — full-address-less "New York, NY" with no Cambridge mention anywhere in careers — reads as an entity Google cannot merge with the Cambridge `LocalBusiness`, actively fragmenting local entity signals. |
| `JobPosting.jobLocation` has city/region/country only, no `streetAddress` | Medium | `pages/careers/[slug].tsx:124-132` | Not required by Google Jobs, but combined with the city mismatch above it removes any anchor that could reconcile the two identities. Add a real address if the NYC location is genuine. |
| No visible NAP anywhere in primary UI chrome (header/footer) | Medium | `components/FooterSection/Footer.tsx` — no match for address/phone/city; address only appears buried in Terms of Service/Privacy Policy body copy | For local entity trust (and citation-matching crawlers), put the canonical NAP in the visible site footer on every page, not only inside legal boilerplate. |
| No Tier-1 or B2B-specific citations detectable from on-site signals | Medium | No Yelp/BBB/Clutch/G2/UpCity badges, links, or embeds found anywhere in components or pages | Build citations on directories relevant to a B2B agency: Google Business Profile, Bing Places, Clutch, G2, UpCity, DesignRush, Chamber of Commerce (Cambridge), LinkedIn Company Page (present), Crunchbase. Yelp/BBB are lower priority for this vertical but still worth claiming defensively (ironically, a testimonial on-site brags about growing a *client's* Yelp reviews — Vierra has no visible Yelp presence of its own). |
| No `sameAs` link to a Google Business Profile / Maps place page | Low-Medium | `sameAs` array in both Organization and LocalBusiness schema only lists LinkedIn/Instagram/Facebook/X | Add the GBP Maps URL to `sameAs` once a Business Profile exists, to help Google merge the schema entity with the GBP entity. |

---

## 3. LocalBusiness Schema Model Appropriateness

**Core question: is a national B2B lead-gen agency well-served by `["ProfessionalService",
"LocalBusiness"]` plus storefront-flavored properties (`openingHoursSpecification`,
`priceRange`, city-level `areaServed`)? Only partially — and as configured, it sends mixed
signals.**

- `ProfessionalService` is the correct, Google-recommended schema.org subtype for an agency —
  keep it. Schema.org has no dedicated "MarketingAgency"/"AdvertisingAgency" type, so this is
  the right choice and does not need to change.
- Stacking `"LocalBusiness"` alongside it, plus `openingHoursSpecification` (Mon–Fri 9–5) and
  `priceRange: "$$$"`, are **storefront/local-pack signals**. These help *only* if Vierra wants
  local-pack eligibility for queries like "digital marketing agency Cambridge MA" — which
  conflicts with the site's own positioning (FAQ: "we serve clients across the United States,
  working remotely with businesses wherever they operate"). For a company actively trying to
  win *national* B2B search/AI-answer visibility, `openingHoursSpecification` and `priceRange`
  add little value and slightly reinforce a local-only read of the entity to crawlers — they
  are low-risk to keep (they're accurate, if the office really does keep those hours) but
  shouldn't be treated as meaningful ranking levers here.
- `areaServed: [City: Cambridge, City: Medford, Country: United States]` is internally
  incoherent: two small Massachusetts cities plus the entire country, with nothing in between
  (no "Massachusetts", no "Greater Boston", no target regions/industries the agency actually
  sells into). This reads as a template default rather than an intentional local + national
  strategy.
  - **Recommendation:** either drop the two city entries and declare `areaServed: Country
    "United States"` only (matches the actual national B2B sales motion), or, if there is a
    genuine reason to court hyper-local Cambridge/Boston-metro clients (e.g., in-person
    consulting), keep Cambridge but replace "Medford" with something coherent like
    "Greater Boston" / "Massachusetts" and add a short paragraph of real local content to
    back it up (see §4).
- **Recommended entity model going forward:** keep `Organization` (parent brand entity) +
  `ProfessionalService` (service-provider entity) as the primary pair; keep `LocalBusiness` as
  a secondary type only if the Cambridge address is a real, staffed, physically visitable
  office (needed for GBP eligibility) — if it is not (e.g., a registered/mailing address or
  co-working suite with no walk-in clients), drop `LocalBusiness` and the storefront properties
  entirely and rely on `Organization` + `ProfessionalService` + `PostalAddress` only. Do not
  create a second `LocalBusiness` entity for NYC unless it is a real, independently staffed,
  GBP-verifiable location.

| Issue | Severity | Evidence | Recommendation |
|---|---|---|---|
| `areaServed` mixes two unrelated cities with the whole country, no regional tier | Medium | `app/layout.tsx:262-266` | Replace with `Country: United States` alone, or a coherent local tier (Massachusetts/Greater Boston) if local business is genuinely pursued |
| `LocalBusiness` + storefront properties (`openingHoursSpecification`, `priceRange`) may mismatch actual "remote, national" positioning | Low-Medium | FAQ copy vs. schema fields, `app/layout.tsx:249-278` | Confirm Cambridge is a real staffed office; if not, drop `LocalBusiness` subtype and storefront properties, keep `Organization`/`ProfessionalService` only |
| `geo` coordinates given to 4 decimal places (42.3736, -71.1097) | Low | `app/layout.tsx:251-252` | Extend to 5 decimal precision (~1m accuracy) once a confirmed office rooftop/entrance coordinate is available |
| No `hasMap` property linking to a Google Maps place page | Low | Not present in LocalBusiness schema | Add once a GBP/Maps listing exists |

---

## 4. GBP Signals, Citations, and Reviews

No Google Business Profile, Maps embed, place reference, review widget, or GBP-post indicator
was found anywhere in the codebase or on rendered pages (no `iframe`/script referencing
`google.com/maps`, no `aggregateRating`, no review-count badge). This cannot be fully verified
without direct GBP/Maps API or paid-tool access (see Limitations), so the following is a
checklist against public, on-site evidence only.

### GBP checklist (detected vs. missing)

| Item | Status | Notes |
|---|---|---|
| Maps embed / directions link on site | Missing | No matches anywhere in components/pages |
| GBP place reference / `hasMap` in schema | Missing | — |
| Review widget / star-rating badge | Missing | 8 written testimonials exist (`components/TestimonialSection/Testimonials.tsx`) but are plain text, not marked up as `Review`/`aggregateRating` schema |
| `aggregateRating` in LocalBusiness schema | Missing | No `Review`/`aggregateRating` anywhere in repo (confirmed via full-repo search) |
| Primary GBP category signal (on-page) | Cannot verify without GBP access | Whitespark 2026: primary category is the **#1** ranking factor and wrong category is the **#1 negative factor** — this is the single highest-leverage GBP item and needs direct GBP-dashboard verification, not just page content |
| Tier-1 citations (Yelp, BBB) | Missing (from on-site signals) | No badges/links; testimonial text ironically references growing a *client's* Yelp presence, not Vierra's own |
| B2B-relevant citations (Clutch, G2, UpCity, DesignRush) | Missing (from on-site signals) | Higher-value citation targets for this vertical than Yelp/BBB |

### Recommended GBP setup for this business

- **Primary category:** "Marketing Agency" (or "Internet Marketing Service") — broad enough to
  cover SEO/ads/lead-gen/web without being wrong-category-penalized. Secondary categories:
  "Advertising Agency", "SEO Agency", "Website Designer".
- **Profile type:** Given the remote/national delivery model and small team, register as a
  **Service Area Business (SAB)** with the Cambridge address hidden from Maps (pin suppressed,
  service-area radius/regions shown) rather than a public storefront pin — this resolves the
  local-pack-vs-national tension noted in §3 without requiring any code change.
- **Review velocity:** zero visible reviews today. Whitespark/Sterling Sky's "18-day rule"
  means rankings can fall off a cliff after ~3 weeks without a new review — with no reviews
  visible at all, Vierra is not in the game. Stand up a lightweight post-project review-request
  flow (email/SMS) targeting a review every 2–3 weeks minimum.
- **Reviews → schema:** once real reviews exist on Google/Clutch/G2, add genuine
  `aggregateRating` + `Review` markup sourced from those platforms (never fabricate ratings).
- **GBP Posts/photos:** add team/office photos and periodic Posts — currently zero photo
  evidence of a physical Cambridge presence anywhere on the site, which will also matter if a
  storefront-style profile is ever pursued.

---

## 5. Local Content Assessment

The site has **no dedicated location/city landing pages** (no `/locations`, no
"Cambridge digital marketing agency" page, no Boston-metro content found via repo search), and
the only local textual references are the bare address strings in legal pages and the single
FAQ sentence. Given Whitespark's finding that **dedicated service pages are the #1 local
organic ranking factor and #2 AI-visibility factor** (not city pages), this is the right
prioritization for a *national* B2B agency: investing in city-specific Cambridge/Boston content
would mostly help if Vierra wants in-person local clients, which contradicts the "remote,
serves the whole US" positioning. **Recommendation: do not build Cambridge/Boston location
pages purely for local SEO; instead ensure the service pages (SEO, ads, lead gen, web) are
individually indexable, well-linked from navigation, and internally consistent** — that is a
higher-leverage lever than local landing pages for this business model. The one exception: a
single, well-built About/Team page showing the real Cambridge office (photos, team, address, a
map) would materially help entity trust/E-E-A-T and GBP-schema corroboration without pursuing
local-pack rankings inappropriately.

| Issue | Severity | Evidence | Recommendation |
|---|---|---|---|
| No visible, user-facing NAP or map on any indexable page | Medium | Footer/header search found no address/map; address only in legal-page body copy | Add a compact NAP block (address, phone, map link) to the global footer |
| No location/E-E-A-T content (office photos, team-in-Cambridge signals) | Low-Medium | No matches for office imagery/location content outside legal boilerplate | Add a short "Where we work" section/photo to the About or homepage footer, tied to the canonical Cambridge address |
| City-level local content not pursued | Informational | No `/locations` or city pages found | Correctly deprioritized for a national B2B model — do not build city pages; invest in service pages instead (see recommendation above) |

---

## 6. Local SEO Score

| Dimension | Weight | Assessment |
|---|---|---|
| GBP Signals | 25% | Weak/unverifiable — no on-site GBP evidence at all (no Maps embed, no place ref, no reviews). Score this dimension low until GBP is confirmed and optimized. |
| Reviews & Reputation | 20% | Weak — 8 strong testimonials exist but are un-schema'd plain text; zero visible aggregate rating or review count anywhere. |
| Local On-Page SEO | 20% | Mixed — no NAP in visible UI, no location content, but correctly avoids over-investing in local-pack content given the national model. |
| NAP Consistency & Citations | 15% | Poor — active 3-way conflict across live production surfaces (schema vs. live llms.txt/FAQ vs. careers), plus a looming regression (founding year) in the current branch; no citations detected. |
| Local Schema Markup | 10% | Good structure, present properties, but internally incoherent `areaServed` and possible type-mismatch (LocalBusiness + storefront props for a non-storefront business). |
| Local Link & Authority Signals | 10% | Cannot assess (needs backlink/citation tooling — see Limitations). |

Given the severity and breadth of the NAP conflict (the single most important input to this
audit) and the complete absence of GBP/review signals, this dimension set should be treated as
**a high-priority remediation area**, not a minor cleanup — it affects entity resolution for
both classic local search and AI-answer engines site-wide, not just one page.

---

## 7. Top Prioritized Actions

1. **[Critical]** Decide and document the single canonical NAP (recommended: Cambridge, MA
   02138, +1‑339‑333‑0929, founded 2019) and update it in **one coordinated deploy** across:
   live `llms.txt`, `lib/faq.ts` FAQ answer + `FAQPage` schema, `lib/careers.ts`/
   `pages/careers/[slug].tsx` `JobPosting.jobLocation`, and `pages/careers.tsx` meta/keywords.
2. **[Critical]** Before merging this branch, fix `public/llms.txt` `Founded: 2024` back to
   `2019` to match `app/layout.tsx` — otherwise a currently-consistent field becomes newly
   inconsistent on next deploy.
3. **[High]** Resolve the careers-section identity: either move all job postings/copy to
   Cambridge, MA, or, if NYC is a real second office, give it a genuine full address and model
   it as a documented secondary location (not an undocumented, unreferenced one).
4. **[High]** Reconcile the FAQ answer's new "Cambridge HQ with a NYC office" phrasing (branch)
   against the careers section, which still shows zero Cambridge reference — these two
   surfaces must tell the same story or not mention a second office at all.
5. **[High]** Stand up (or confirm/audit) a Google Business Profile as a Service Area Business,
   category "Marketing Agency", and begin a recurring review-generation cadence to avoid the
   18-day ranking cliff.
6. **[High]** Add `Review`/`aggregateRating` schema sourced from real, verifiable ratings
   (Google/Clutch/G2) once available — do not mark up existing testimonial copy without a
   backing review platform.
7. **[Medium]** Clean up `areaServed` (drop the incoherent Cambridge+Medford+US mix; use
   `Country: United States` alone, or a real regional tier if local business is pursued).
8. **[Medium]** Claim/build B2B-relevant citations (Clutch, G2, UpCity, DesignRush, Bing Places,
   Chamber of Commerce) and add the eventual GBP Maps URL to the `sameAs` array.
9. **[Medium]** Surface the canonical NAP in the site's visible global footer, not only inside
   Terms of Service/Privacy Policy body copy.
10. **[Low]** Extend `geo` coordinates to 5-decimal precision and add `hasMap` once a confirmed
    office location/Maps listing exists; re-evaluate whether `LocalBusiness` + storefront
    properties (`openingHoursSpecification`, `priceRange`) should remain if Cambridge is not a
    walk-in office.

---

## Limitations

- No access to the actual Google Business Profile dashboard, Google Maps Platform, or paid
  citation-tracking tools (Whitespark, BrightLocal, Moz Local) — GBP primary-category
  correctness, review authenticity/velocity, and true citation NAP-match rates could not be
  directly verified and are assessed only from on-site/public-repo evidence.
- Proximity (55.2% of ranking variance per Search Atlas) is outside this audit's or the site
  owner's control and is noted here only for context, not scored.
- Backlink/local-authority signals (Dimension 6, 10% weight) could not be assessed without
  third-party link-index tooling.
- Live-site verification in this pass relied on a `curl` fetch of the FAQ page and `git show
  master:lib/faq.ts` (both successful) plus a peer agent's earlier confirmation of the live
  `llms.txt` content; a fresh, full live crawl (homepage, careers, footer render) was not
  re-run in this final pass — findings above are cross-checked against source in the repository
  wherever the live fetch was not repeated.


---



<br>

# PART V — Off-Page / Backlinks

<sub>Source file: `vierradev.com-audit/findings/backlinks.md`</sub>


---

# Backlink & Off-Page Authority Profile — vierradev.com

**Audit date:** 2026-07-10
**Domain:** vierradev.com (B2B lead-generation / digital marketing agency, Cambridge MA, founded 2019, ~5-10 employees)

## Data Availability Notice (read first)

No paid or API-based backlink data source was available for this audit:

- **Moz API:** no credentials configured (checked `.env` — no `MOZ_*` keys present).
- **Bing Webmaster Tools:** no credentials configured (no `BING_*` keys present).
- **DataForSEO:** no extension installed, no credentials present.
- **Common Crawl web-graph tooling:** the analysis scripts this workflow normally calls (`commoncrawl_graph.py`, `moz_api.py`, `bing_webmaster.py`, `backlinks_auth.py`, `verify_backlinks.py`, `validate_backlink_report.py`) are **not present in this repository/environment** — a filesystem-wide search found none of them. This audit could not run the standard Tier 0-3 workflow at all.

To avoid delivering nothing, two free, unauthenticated, public endpoints were queried directly and the live homepage was crawled manually:

1. Direct HTTP fetch of `https://vierradev.com/` (raw HTML, no JS execution) — used to verify actual outbound links against claimed partner/social relationships.
2. Internet Archive Wayback Machine CDX API (`web.archive.org/cdx/search/cdx`) — free, public, no auth required.
3. Common Crawl Index API (`index.commoncrawl.org`) — attempted; **no captures found** for vierradev.com in the queried index. This is inconclusive (the domain may appear in other crawl snapshots not queried, or CC may simply not have crawled it), not a confirmed absence, and it does not substitute for the Common Crawl **web graph** dataset (host-level PageRank/harmonic-centrality/in-degree), which is a multi-gigabyte bulk file not fetchable via a simple query and was not available in this environment.

**No referring-domain count, DA/PA proxy, anchor-text distribution, or toxic-link/spam-score data could be obtained from any source.** Per the standard scoring policy, when fewer than 4 of the 7 weighted scoring factors have any data source, a numeric Backlink Health Score must not be produced.

## Backlink Health Score: INSUFFICIENT DATA (not scored)

Scoring this against 0-100 would be misleading — 6 of 7 weighted factors (referring domain count, domain quality distribution, anchor text naturalness, toxic link ratio, link velocity, follow/nofollow ratio, geographic relevance) have **zero** data coverage. Only a partial, manual outbound-link verification was possible, which is not a backlink metric at all (it checks links *from* the site, not *to* it).

## Findings Table

| Factor | Status | Data Source | Confidence | Notes |
|---|---|---|---|---|
| Referring domain count | No data | — | — | No Moz/Bing/DataForSEO/CC-webgraph access. Not estimable. |
| Domain Authority / Page Authority proxy | No data | — | — | Moz API required; not configured. |
| Anchor text distribution | No data | — | — | Requires Moz/Bing/DataForSEO anchor endpoints; none available. |
| Toxic / spam link ratio | No data | — | — | Requires Moz Spam Score or DataForSEO; none available. |
| Link velocity trend | No data | — | — | DataForSEO-only metric in this workflow; not installed. |
| Follow/nofollow ratio | No data | — | — | Requires DataForSEO or Bing link detail; none available. |
| Geographic relevance of links | No data | — | — | Requires DataForSEO or Bing country data; none available. |
| Wayback Machine crawl footprint | Thin | archive.org CDX API (public) | 0.40 (weak proxy, not a backlink metric) | Earliest capture found: 2024-07-14. Only ~9 distinct daily capture events returned. Indicates a young, lightly-crawled site — consistent with a small agency founded 2019 but with limited historical web visibility. This is **not** a backlink signal; it only reflects search-engine/archive crawl frequency. |
| Common Crawl presence | Not found in queried index | index.commoncrawl.org CDX API | 0.30 (inconclusive) | Query against the available CC index returned "No Captures found." Does not confirm the domain is absent from Common Crawl overall (only one index was queried and CC coverage of small sites is incomplete); cannot be used to infer in-degree or PageRank. |
| Outbound partner links — homepage (raw HTML, no JS) | Partially confirmed | Direct crawl of vierradev.com (curl, this session) | 0.90 (directly observed) | Confirmed present as live `<a href>` in raw server HTML: **isenberg.umass.edu**, **ironandwaterco.com**, **somervilledentalassociates.com**, plus `github.com/Vierra-Digital`. **Not found** in the raw HTML response: `usegl.com`, `thearoundhub.com`, `freeclass.qigonginfusedyoga.com` — these three appear in the site's own source (`app/page.tsx`, partners section) but did not render into the fetched HTML. This could mean they load only after client-side JS/hydration (this crawl did not execute JS), or that the live deployment differs from the current source tree. **Flagged for confirmation with a JS-rendered fetch, not asserted as broken.** |
| Social profile links (sameAs) | Confirmed | JSON-LD `sameAs` in homepage HTML (this session) | 0.95 (directly observed) | `linkedin.com/company/vierra`, `instagram.com/vierra.dev`, `facebook.com/share/1GXE6s4NSX...`, `x.com/vierradev` all present in structured data. These are **outbound** declarations of identity, not inbound backlinks — they help entity/knowledge-graph association but do not by themselves constitute link equity. |

**Data freshness:** Wayback/Common Crawl checks were run live in this session (2026-07-10). No cached/stale data was used. Note none of Moz's ~3-day, Bing's near-real-time, or CC's quarterly cadences apply here since none of those sources returned data.

## Link-Gap Framing for a Small B2B Lead-Gen Agency

Because no competitor or referring-domain data could be pulled, this is a **qualitative** gap analysis based on business model and the known partner relationships, not a data-driven comparison. A B2B lead-gen agency at this stage typically needs links in these categories, roughly in order of ROI-per-effort for a 5-10 person team:

1. **Client/partner backlinks (highest leverage, already half-built).** The homepage already outputs links *to* isenberg.umass.edu, ironandwaterco.com, usegl.com, thearoundhub.com, freeclass.qigonginfusedyoga.com, and somervilledentalassociates.com. The gap is the **reciprocal direction**: do any of those six sites link back to vierradev.com (e.g., a "built by Vierra" credit, a client testimonial page, a case study)? This was not verifiable (would require crawling each of the six external sites, which was out of scope/budget for this pass) — **flag as an open item**, not confirmed either way.
2. **Local Cambridge/Boston-area business citations & directories** (Chamber of Commerce, Cambridge Local First, Built In Boston, Clutch, DesignRush, UpCity, GoodFirms) — low effort, decent local relevance signal, directly attainable.
3. **Industry/niche directories for marketing agencies** (Clutch.co, Sortlist, Agency Spotter, HubSpot Solutions Directory if using HubSpot partner status) — standard for lead-gen agencies, easy wins.
4. **Digital PR / HARO-style journalist requests** (Connectively/Qwoted, HARO successor platforms) — agency staff commenting on marketing/lead-gen trends; moderate effort, higher authority payoff.
5. **Guest posts / contributed articles** on marketing, sales-ops, or SaaS-adjacent blogs — positions Vierra's own team as subject-matter experts; also supports E-E-A-T (see cross-reference below).
6. **Academic/institutional link (isenberg.umass.edu)** — UMass Isenberg School of Management is unusually high-authority for a small agency's link profile. Worth exploring whether this is a case study, sponsorship, guest lecture, or alumni relationship — if so, request a reciprocal or contextual link from an Isenberg page (e.g., "outcomes" or "industry partners" page) rather than only linking outward to them.
7. **Case-study pages with client co-marketing** — Iron & Water Co., Granite Logistics (usegl.com), The Around Hub, Qigong Infused Yoga, and Somerville Dental Associates are all plausible candidates for a joint case study or testimonial swap that yields a genuine client-side backlink.

## Prioritized Link-Building Roadmap

### Priority: Critical
- **Confirm whether the 3 partner links that didn't render in raw HTML (usegl.com, thearoundhub.com, freeclass.qigonginfusedyoga.com) are actually live for users and crawlers.** Re-check with a JS-rendering fetch or manual browser view; if they're client-only rendered, consider server-rendering the partners section so search engines and non-JS crawlers see the outbound relationship (this affects how CC/Bing/Google associate Vierra with these partners going forward).
- **Audit the 6 partner sites for a reciprocal link back to vierradev.com.** If none exist, request one (a simple "Marketing by Vierra" footer credit or case-study callout) — this is the single fastest, lowest-cost real backlink opportunity available given the existing relationships.

### Priority: High
- **Claim/verify listings on Clutch.co, Sortlist, Agency Spotter, GoodFirms, DesignRush, UpCity** — direct, high-relevance backlinks for a B2B marketing agency, typically indexed and followed.
- **Cambridge/Boston local citations:** Cambridge Chamber of Commerce, Cambridge Local First, Built In Boston. Ensures NAP consistency also helps local SEO (cross-reference: this audit's technical/local findings noted a Cambridge vs. NYC location conflict — resolve that *before* pursuing local citations so the NAP data submitted is consistent).
- **Publish 1-2 client case studies** (e.g., with Somerville Dental Associates or Iron & Water Co.) with the client's permission to co-promote/link from their site.

### Priority: Medium
- **HARO/Qwoted-style digital PR outreach** — target marketing, sales, and SMB-focused publications; 2-4 pitches/month is sustainable for a small team.
- **Guest posts** on 2-3 relevant marketing/SaaS blogs per quarter, written by founder/team members — supports both backlinks and topical authority.
- **Investigate the Isenberg (UMass) relationship** for a legitimate, permission-based reciprocal or contextual link (alumni page, guest lecture recap, case study) rather than treating the outbound logo as sufficient.

### Priority: Low
- **Social profile completeness** (LinkedIn, Instagram, X, Facebook) — already present via `sameAs`; keep profiles active since they support entity signals even though they are typically nofollow and low direct link-equity value.
- **Re-run this audit with real tooling** once available: install/configure Moz API, Bing Webmaster Tools, and/or the DataForSEO extension (`./extensions/dataforseo/install.sh` if present in a future environment) so referring-domain counts, DA/PA, anchor text, and toxic-link data can actually be measured. Until then, all future off-page work should be tracked manually (a simple spreadsheet of outreach → link → follow/nofollow → anchor text) so a real baseline exists once tooling is available.

## Cross-Skill References
- Client-facing E-E-A-T / content authorship signals that support the guest-post and digital-PR recommendations above: run `/seo content <url>`.
- Crawlability/renderability concerns raised here (JS-rendered partner links) overlap with technical SEO: run `/seo technical <url>` to confirm SSR vs. CSR behavior of the partners section.

## Summary of Confidence Levels Used
- **0.90-0.95:** Directly observed in this session (raw HTML fetch, JSON-LD parsing).
- **0.30-0.40:** Free public API queried live, but weak/indirect proxy for authority (Wayback, Common Crawl index).
- **No data / not scored:** Every metric that would normally come from Moz, Bing, DataForSEO, or the Common Crawl web-graph dataset, since none of those sources were reachable in this environment.


---



<br>

# PART VI — Content Cluster Strategy

<sub>Source file: `vierradev.com-audit/findings/content-clusters.md`</sub>


---

# Content Cluster Architecture — vierradev.com

Audit date: 2026-07-10
Scope: Hub-and-spoke topic clusters for Vierra's blog, mapped against the live site's
single-page commercial architecture (homepage + `/#services` anchor; no dedicated
service landing pages exist today).

## 0. Inputs and constraints found in the codebase

- **Blog is DB-backed, not file-based.** Posts live in Postgres (`prisma/schema.prisma`
  `BlogPost` model) via `lib/blog.ts`; there is no `content/*.md` post archive to grep.
  Live titles were pulled directly from `https://vierradev.com/blog` to check for
  cannibalization before proposing new posts (see §3).
- **No dedicated service/landing pages.** `components/FooterSection/Footer.tsx` and
  `Header.tsx` route all commercial intent to `/#services` (labelled "GTM Engine") on
  the single-page homepage. There is no `/services`, `/lead-generation`, or
  `/appointment-setting` URL. This matters for architecture: every cluster pillar
  below is a **blog post**, and the mandatory pillar->CTA path is "blog pillar ->
  `/#services` anchor," not "blog pillar -> service page." Two pillars are flagged as
  candidates for a future dedicated landing page (§6).
- **Existing blog content (11 live posts, from `/blog`):** "B2B Lead Generation in
  2026: Fill Your Calendar, Skip the Ad Gamble," "How Much Does Lead Generation Cost
  In 2026?," "How To Choose A Lead Generation Agency In 2026 (A Practical Checklist),"
  "SEO In 2025. How I'd Learn It If I Were Starting Over.," "The Psychology of Sales:
  How Buyers Decide," "Psychology Behind Premium Advertising," "What Everyone Can
  Learn From Chick-fil-A's Marketing," "Copy This Strategy to Increase Leads and Lower
  Ad Spend," "You're Being Replaced, AI and Layoffs," "Medford MA Digital Marketing:
  How Vierra Grows Local Businesses," "From Middle School to Founding Vierra's Story."
  Four of these already occupy cluster slots below and should be **updated in place**,
  not duplicated (this is the single biggest cannibalization risk found — see §3).
- **8 bounded SERP sanity-checks** were run (WebSearch) on head terms to confirm
  intent and competitor sets before allocating clusters: "B2B lead generation
  services," "guaranteed lead generation company," "marketing automation for B2B,"
  "sales pipeline optimization strategies," "appointment setting services for B2B,"
  "go-to-market strategy framework," "what is answer engine optimization AEO,"
  "omnichannel outreach strategy B2B sales."

## 1. SERP sanity-check summary

| Query | Dominant SERP type | Intent | Recurring competitors |
|---|---|---|---|
| B2B lead generation services | Agency listicles + tool roundups | Commercial | Belkins, Callbox, SalesRoads, UnboundB2B, Zendesk/Salesforce guides |
| guaranteed lead generation company | Niche agency pages, "guarantee" model pages | Commercial/Transactional | Belkins, SalesBread, GuaranteedLeadsNow, Inbouncy |
| marketing automation for B2B | Vendor category pages + platform guides | Informational/Commercial | HubSpot, Salesforce, Gartner, 6sense, Marketo |
| sales pipeline optimization strategies | How-to guides, sales-ops blogs | Informational | HubSpot, Salesforce, Highspot, Gartner, Outreach |
| appointment setting services for B2B | Agency service pages + Clutch directory | Commercial | Belkins, SalesRoads, Callbox, UnboundB2B, Clutch |
| go-to-market strategy framework | Long-form frameworks/guides | Informational | Gartner, Asana, HBS Online, Salesforce, Stripe |
| what is answer engine optimization (AEO) | Definitional guides, agency thought-leadership | Informational | Forbes, HubSpot, Conductor, CXL, Frase, Profound |
| omnichannel outreach strategy B2B sales | How-to guides + agency blogs | Informational | CIENCE, Instantly, Martal, Belkins, HubSpot |

**Read:** "B2B lead generation," "guaranteed lead generation," and "appointment
setting" share the same competitor set (Belkins, SalesRoads, Callbox, UnboundB2B) —
they are semantically adjacent and must be kept as **separate pillars in separate
funnel stages** (broad awareness vs. guarantee/pricing model vs. outbound execution),
never merged into one page, or they will cannibalize each other. "Marketing
automation / GTM" and "AEO" sit in entirely distinct SERP neighborhoods (SaaS
vendors, enterprise research firms, AI-search publications) with no overlap against
the lead-gen cluster — safe to run as independent authority-building clusters.

## 2. Cluster architecture (5 pillars, 20 spokes)

Word-count targets: pillar 2,500-4,000 words; spoke 1,200-1,800 words.
`[EXISTING]` = live post to update/retitle in place, not duplicate.

### Cluster 1 — B2B Lead Generation (core awareness pillar)

| Role | Title | Intent | Funnel | Target keyword | Page type |
|---|---|---|---|---|---|
| Pillar | [EXISTING] "B2B Lead Generation in 2026: Fill Your Calendar, Skip the Ad Gamble" | Informational | TOFU | b2b lead generation | Blog pillar |
| Spoke | [EXISTING] "How Much Does Lead Generation Cost In 2026?" | Commercial investigation | MOFU | b2b lead generation cost | Blog spoke |
| Spoke | "Inbound vs. Outbound B2B Lead Generation: Which Wins in 2026?" | Informational | TOFU | inbound vs outbound lead generation | Blog spoke |
| Spoke | "B2B Lead Generation Strategies That Actually Fill Pipeline in 2026" | Informational | TOFU | b2b lead generation strategies | Blog spoke |
| Spoke | "MQL vs. SQL: How to Tell When a Lead Is Actually Sales-Ready" | Informational/Commercial | MOFU | mql vs sql | Blog spoke |

### Cluster 2 — Guaranteed / Risk-Averse Lead Generation (brand-differentiator pillar)

| Role | Title | Intent | Funnel | Target keyword | Page type |
|---|---|---|---|---|---|
| Pillar | "What Is Risk-Averse (Guaranteed) Lead Generation, and Does It Actually Work?" | Commercial | MOFU/BOFU | guaranteed lead generation | Blog pillar; **candidate future landing page** |
| Spoke | [EXISTING, reassigned] "How To Choose A Lead Generation Agency In 2026 (A Practical Checklist)" | Transactional | BOFU | how to choose a lead generation agency | Blog spoke |
| Spoke | "Pay-Per-Lead vs. Retainer vs. Guaranteed Leads: Which Pricing Model Should You Pick?" | Commercial | MOFU | pay per lead vs guaranteed leads | Blog spoke |
| Spoke | "Performance-Based Marketing Agencies: 7 Questions to Ask Before You Sign" | Transactional | BOFU | performance based marketing agency | Blog spoke |
| Spoke | "Lead Generation Guarantees: Red Flags to Watch For" | Commercial | MOFU | lead generation guarantee red flags | Blog spoke |

### Cluster 3 — Sales Pipeline & Appointment Setting

| Role | Title | Intent | Funnel | Target keyword | Page type |
|---|---|---|---|---|---|
| Pillar | "B2B Appointment Setting Services: The Complete Buyer's Guide" | Commercial | MOFU/BOFU | b2b appointment setting services | Blog pillar; **candidate future landing page** |
| Spoke | "Sales Pipeline Optimization: A Step-by-Step Framework" | Informational | TOFU/MOFU | sales pipeline optimization | Blog spoke |
| Spoke | "In-House SDRs vs. Outsourced Appointment Setting: Cost & ROI Compared" | Commercial | MOFU | outsourced appointment setting | Blog spoke |
| Spoke | "Why Your Sales Pipeline Is Leaking (and How to Fix It)" | Informational | TOFU | sales pipeline drop-off | Blog spoke |
| Spoke | "B2B Appointment Setting Pricing: What Agencies Actually Charge in 2026" | Commercial | MOFU | appointment setting cost | Blog spoke |

### Cluster 4 — Marketing Automation & GTM Strategy

| Role | Title | Intent | Funnel | Target keyword | Page type |
|---|---|---|---|---|---|
| Pillar | "Go-to-Market Strategy Framework: A 9-Step Guide for B2B Companies" | Informational | TOFU | go-to-market strategy | Blog pillar |
| Spoke | "B2B Marketing Automation: What It Is and How to Build Your First Workflow" | Informational | TOFU | marketing automation for b2b | Blog spoke |
| Spoke | "Best B2B Marketing Automation Platforms in 2026, Compared" | Commercial investigation | MOFU | best b2b marketing automation platforms | Blog spoke |
| Spoke | "Product Launch Checklist: Aligning Sales and Marketing for GTM" | Informational | TOFU | product launch gtm checklist | Blog spoke |
| Spoke | "Omnichannel Outreach: How to Combine Email, LinkedIn, and Phone Without Annoying Prospects" | Informational/Commercial | TOFU/MOFU | omnichannel outreach b2b | Blog spoke |

### Cluster 5 — AEO/GEO & AI Search Visibility (low-competition authority play)

| Role | Title | Intent | Funnel | Target keyword | Page type |
|---|---|---|---|---|---|
| Pillar | "Answer Engine Optimization (AEO): The Complete Guide for B2B Brands" | Informational | TOFU | answer engine optimization | Blog pillar |
| Spoke | [EXISTING, refresh/retitle] "SEO In 2025. How I'd Learn It If I Were Starting Over." -> retitle "SEO Fundamentals in 2026: What Still Works" | Informational | TOFU | seo fundamentals | Blog spoke |
| Spoke | "AEO vs. SEO vs. GEO: What's the Difference and Do You Need All Three?" | Informational | TOFU | aeo vs seo vs geo | Blog spoke |
| Spoke | "How to Get Cited by ChatGPT and Google AI Overviews: An AEO Checklist" | Informational | TOFU | how to get cited by chatgpt | Blog spoke |
| Spoke | "Is Traditional SEO Dead? What B2B Marketers Need to Know About AI Search" | Informational | TOFU | is seo dead ai search | Blog spoke |

### Orphan / unmapped existing posts

Not forced into the 5 clusters; interlink opportunistically rather than restructure:

- "Copy This Strategy to Increase Leads and Lower Ad Spend" — thematically close to
  Cluster 1; add 1-2 contextual links to/from Cluster 1 spokes.
- "The Psychology of Sales: How Buyers Decide" / "Psychology Behind Premium
  Advertising" / "What Everyone Can Learn From Chick-fil-A's Marketing" — brand
  thought-leadership; link from Cluster 3 (appointment setting/sales) as "further
  reading," no dedicated keyword target.
- "You're Being Replaced, AI and Layoffs" — link from Cluster 5 (AI theme overlap).
- "Medford MA Digital Marketing: How Vierra Grows Local Businesses" — seed of a
  potential future **local-SEO cluster**; out of scope for this plan, flag for a
  follow-up pass if Vierra wants to target local-market keywords.
- "From Middle School to Founding Vierra's Story" — founder/brand story, no cluster
  fit; leave as About-adjacent content.

## 3. Cannibalization check

| Risk | Pages involved | Assessment | Action |
|---|---|---|---|
| High (avoided) | New "how to choose a B2B lead gen partner" idea vs. existing "How To Choose A Lead Generation Agency" | Same query intent, would be a duplicate | Do not create a new post; existing post is assigned exclusively to Cluster 2, spoke slot |
| Medium | Existing "How Much Does Lead Generation Cost" (Cluster 1) vs. new "Pay-Per-Lead vs. Retainer vs. Guaranteed Leads" (Cluster 2) | Both touch pricing; different angle (absolute cost vs. pricing-model comparison) | Keep as two posts, interlink tier only (2-3 shared subtopics), differentiate H1/meta clearly |
| Medium | Cluster 1 pillar ("b2b lead generation") vs. Cluster 2 pillar ("guaranteed lead generation") | Same competitor set in SERP (Belkins, SalesRoads) but distinct query and funnel stage | Two separate pillars is correct; mandatory cross-link, do not target both queries on either page |
| Low-medium | Existing "SEO In 2025..." vs. new AEO pillar | Same broad topic family (search) | Retitle/refresh existing post to own only "SEO fundamentals," let new pillar own "answer engine optimization" exact-match |
| None found | Clusters 4 and 5 vs. Clusters 1-3 | Distinct SERP neighborhoods (enterprise SaaS / AI-search publishers vs. lead-gen agencies) confirmed via WebSearch | No action needed |

Limitation: blog posts are stored in Postgres, not in the repo, so this check is based
on the live `/blog` listing pulled 2026-07-10, not a full-text keyword scan. Re-check
the live catalog immediately before publishing each new spoke.

## 4. Internal link matrix

**Mandatory (bidirectional, every spoke <-> its pillar):** each spoke above links to
its cluster pillar in the body (not just breadcrumbs), and each pillar links out to
all of its spokes in a "In this guide" / "Related reading" module. No orphans: all 25
posts (5 pillars + 20 spokes, 4 of which are existing posts) have at least 3 inbound
internal links once the recommended tier below is added.

**Recommended (spoke-to-spoke, within the same cluster):**

- Cluster 1: cost spoke <-> strategies spoke <-> inbound/outbound spoke <-> MQL/SQL spoke (all four cross-link)
- Cluster 2: "how to choose an agency" <-> "red flags" <-> "7 questions to ask" (BOFU trio); pricing-model spoke links into all three
- Cluster 3: "pipeline optimization" <-> "pipeline drop-off" (both TOFU pipeline-health topics); "outsourced SDR" <-> "pricing" (both MOFU vendor-evaluation topics)
- Cluster 4: "marketing automation basics" <-> "platform comparison"; "GTM framework" pillar <-> "product launch checklist" (tightest pair)
- Cluster 5: "AEO vs SEO vs GEO" <-> "SEO fundamentals" (refreshed) <-> "is SEO dead" (all three define/scope the space before the "how to get cited" how-to)

**Optional (cross-cluster, commercial bridging):**

- Cluster 2 pillar (guaranteed leads) <-> Cluster 1 pillar (b2b lead gen) — awareness reader funnels into differentiator pillar
- Cluster 2 pillar <-> Cluster 3 pillar (appointment setting) — "guaranteed leads" and "guaranteed appointments" are adjacent BOFU offers
- Cluster 4 "GTM framework" pillar <-> Cluster 1 pillar — GTM readers are early-funnel, natural bridge into lead-gen content
- Cluster 5 "AEO/GEO" pillar <-> Cluster 1 pillar — ties Vierra's own SEO/AEO/GEO service line back to the core lead-gen offer (cross-sell path)
- Cluster 5 "how to get cited by ChatGPT" spoke <-> Cluster 4 "marketing automation" spoke — both are execution/how-to content for the same marketing-ops persona

**Homepage anchor link (every pillar, mandatory):** each of the 5 pillars includes one
contextual CTA link to `/#services` (labelled to match on-page copy, e.g. "See the
GTM Engine in action") since that is the only commercial conversion surface that
exists today.

## 5. Template / intent-to-format mapping

| Intent | Template | Notes |
|---|---|---|
| TOFU informational | Educational long-form guide, H2/H3 scannable, FAQ block at bottom (feeds `FAQPage` schema and AEO extractability) | Cluster 1, 4, 5 spokes lean here |
| MOFU commercial investigation | Comparison/decision-framework format (tables, criteria checklists) | Cost, pricing-model, platform-comparison spokes |
| BOFU transactional | Checklist + direct CTA to `/#services`, minimal navigation friction | Cluster 2 "red flags," "7 questions," "how to choose an agency" |

## 6. Candidate future landing pages

The site currently routes 100% of commercial intent to one homepage anchor. Once
these two pillars (highest BOFU value and most direct match to Vierra's own
positioning) have validated organic traffic as blog posts, promote them to dedicated
conversion-optimized landing pages with their own URL, form, and schema:

1. `/guaranteed-lead-generation` (from Cluster 2 pillar) — directly matches the site's
   "Risk-Averse Lead Engine" positioning; currently has zero dedicated URL despite
   being the core brand differentiator.
2. `/b2b-appointment-setting` (from Cluster 3 pillar) — highest transactional-intent
   term found in the SERP checks ($3-12K/mo service, buyers in-market).

## 7. 90-day content calendar (13 weeks, ~1.9 posts/week average)

Priority order: (a) refresh the 3 existing posts that anchor clusters first — fastest,
lowest-effort authority gain; (b) publish new pillars before their spokes so internal
links have a target; (c) front-load Cluster 2 (brand differentiator, commercial value)
and Cluster 5 (low-competition authority build) in weeks 1-4.

| Week | Publish | Cluster | Role |
|---|---|---|---|
| 1 | Refresh "B2B Lead Generation in 2026..." + refresh "How Much Does Lead Generation Cost" + refresh "How To Choose A Lead Generation Agency" (retarget/interlink only, no new writing) | 1, 2 | Pillar + 2 spokes (existing) |
| 2 | Publish Cluster 2 pillar: "What Is Risk-Averse (Guaranteed) Lead Generation..." | 2 | Pillar |
| 3 | Publish Cluster 5 pillar: "Answer Engine Optimization (AEO): The Complete Guide" + refresh/retitle "SEO In 2025..." | 5 | Pillar + 1 spoke (existing) |
| 4 | "Lead Generation Guarantees: Red Flags to Watch For" + "Pay-Per-Lead vs. Retainer vs. Guaranteed Leads" | 2 | 2 spokes |
| 5 | "Performance-Based Marketing Agencies: 7 Questions to Ask" + Cluster 3 pillar: "B2B Appointment Setting Services: The Complete Buyer's Guide" | 2, 3 | Spoke + Pillar |
| 6 | "AEO vs. SEO vs. GEO" + "How to Get Cited by ChatGPT and Google AI Overviews" | 5 | 2 spokes |
| 7 | "Sales Pipeline Optimization: A Step-by-Step Framework" + "Why Your Sales Pipeline Is Leaking" | 3 | 2 spokes |
| 8 | Cluster 1 spokes: "Inbound vs. Outbound B2B Lead Generation" + "B2B Lead Generation Strategies That Actually Fill Pipeline" | 1 | 2 spokes |
| 9 | "In-House SDRs vs. Outsourced Appointment Setting" + "B2B Appointment Setting Pricing" | 3 | 2 spokes |
| 10 | Cluster 4 pillar: "Go-to-Market Strategy Framework: A 9-Step Guide" + "Is Traditional SEO Dead?" | 4, 5 | Pillar + spoke |
| 11 | "B2B Marketing Automation: What It Is and How to Build Your First Workflow" + "MQL vs. SQL" | 4, 1 | 2 spokes |
| 12 | "Best B2B Marketing Automation Platforms in 2026, Compared" + "Product Launch Checklist: Aligning Sales and Marketing for GTM" | 4 | 2 spokes |
| 13 | "Omnichannel Outreach: How to Combine Email, LinkedIn, and Phone" + full link-matrix QA pass across all 25 posts (check no orphans, verify pillar<->spoke bidirectional links live) | 4 | Final spoke + QA |

By end of week 13: 5 complete clusters, 25 posts total (4 existing refreshed + 21 new),
full mandatory link matrix live, 2 pillars flagged for landing-page promotion in the
next phase.

## Pre-delivery validation

- [x] No two posts share the same primary target keyword (existing "how to choose an
  agency" and "cost" posts explicitly reassigned/deduplicated against new spoke ideas)
- [x] Every spoke has >=3 planned inbound links (pillar + 2 spoke-to-spoke minimum)
- [x] Every spoke links to its pillar; every pillar links to all its spokes
- [x] No orphan pages in the matrix (orphan *existing* posts outside the 5 clusters are
  explicitly called out in §2 with an opportunistic-interlink plan, not left unlinked)
- [x] Template matches intent classification (§5)
- [x] Word-count targets specified (pillar 2,500-4,000; spoke 1,200-1,800)
- [x] 5 clusters, 4 posts/cluster (1 pillar + 4 spokes) — within 2-5 clusters / 2-4
  posts-per-cluster constraint (spoke count read as "posts beyond the pillar")
- [x] SERP data (§1) supports groupings; cross-cluster overlap (Clusters 1-3) explicitly
  addressed by separating funnel stage rather than merging


---



<br>

# PART VII — Copy & Messaging

<sub>Source file: `vierradev.com-audit/findings/copy-feedback.md`</sub>


---

# Copy & Messaging Feedback — Redesigned Homepage

Grounded in the actual on-page copy (`app/page.tsx` + section components). This is editorial/conversion feedback, distinct from the technical SEO findings. Severity here = impact on clarity/conversion/differentiation.

## The big one: positioning promises enterprise, proof shows local SMB

The page sells a futuristic **B2B go-to-market engine** — eyebrow "B2B Lead Generation," "Your Entire GTM On Autopilot," "autonomous," "Omnichannel," "Sales Intelligence," "Delivery Infrastructure," "150M+ leads generated." But the **social proof tells a different story**:

- Somerville Dental — "grew our **Yelp reviews** and brought in new monthly patients"
- Salon Renee — "**triple the clients** I used to"
- Qigong Infused Yoga, Air-Gen (website build), She Sells Academy, ezML

That's mostly **local service businesses and SMBs**, plus a couple of startups — and one testimonial is about *building a website*, not lead gen. The promise (autonomous enterprise GTM) and the evidence (local SMB marketing wins) don't match. A skeptical buyer notices instantly.

**Recommendation:** pick the lane and align copy to proof. Either (a) lean into "we fill the calendar for growing service businesses & founders" and let the concrete SMB wins shine, or (b) if you're truly moving upmarket to B2B GTM, get B2B proof up front. Right now the headline audience and the testimonial audience are different people.

## Tone whiplash: "Risk-Averse" vs "Explode Profits"

- Brand promise: **"Risk-Averse Lead Engine"** — signals safety, caution, downside protection.
- Footer CTA: **"Want To Explode Profits?"** — hype-y, high-arousal, the opposite register.

These two voices fight each other. "Risk-averse" is your most differentiated idea; don't undercut it with generic hype. Make the whole page sound like the calm, we-take-the-risk operator, and the CTA can still be energetic without the infomercial tone (e.g. "See if we're a fit" / "Get a growth plan").

## "Risk-Averse" is a strong hook but under-explained

"Risk-Averse Lead Engine" is memorable but ambiguous — is *the customer* risk-averse, or is the *offer* low-risk? The mechanism that makes it low-risk is buried in feature cards ("You Get Paid First," "Book 30+ calls, pay after"). **That performance-based / pay-after model is your single best differentiator and it's hidden.** Pull it up near the hero: one line like *"You only pay once we've booked the meetings — we take the risk, not you."* That turns a clever phrase into a concrete promise a CFO can green-light.

## Feature names are clever but benefit-light (jargon tax)

"Brand Universe," "Value Ladder," "TAM Sort & Mining," "Deep Research," "Delivery Infrastructure," "SEO·AEO·GEO." These read as internal codenames. Buyers scan for *outcomes*, not proprietary nouns. Pair each with a plain-language benefit:
- "Brand Universe" → *"A brand that makes prospects reply."*
- "Delivery Infrastructure" → *"Emails that land in the inbox, not spam."*
- "TAM Sort & Mining" → *"We find every buyer who fits your ICP."*

Keep the cool names as labels, but lead with the benefit line.

## Section-by-section notes

| Section | Copy | Note |
|---|---|---|
| Hero H1 | "Risk-Averse Lead Engine For Your Business" | Strong, ownable. Keep. |
| Hero sub | "Construct your funnel, research leads, capture signals, and schedule meetings autonomously." | "**Construct**" is a stiff verb — "Build." "capture signals" is vague — "spot buying signals." Good length otherwise. |
| Eyebrow | "B2B Lead Generation" | See positioning mismatch above. |
| CaseStudies | "Flood Your Sales Calendar" → **"Coming Soon"** | A keyword-named proof section with no proof erodes trust. Fill with a real result or cut the section until ready. |
| Stats | "150M+ leads generated" / "Scale Your Business" | Big number, but abstract and un-attributed. Add context ("across 40+ clients") and a source of credibility. |
| Tailored | "You Get Paid First" | **Best line on the page** — this is the risk-averse proof. Promote it. |
| Testimonials | "See How We Increased Profits For Top Experts…" | Truncated/vague heading; the quotes underneath are specific and great — surface a hard number in the heading instead. |
| Footer CTA | "Want To Explode Profits?" | Tone mismatch (see above). |

## Quick wins
1. Add a one-line explanation of the pay-after/performance model near the hero.
2. Fix or remove the "Coming Soon" case-studies block.
3. Reconcile audience: align eyebrow + testimonials to the same buyer.
4. Soften the "Explode Profits" CTA to match the risk-averse brand voice.
5. Add benefit lines under the clever feature names.
6. "Construct" → "Build"; "capture signals" → "spot buying signals."
7. Kill "guaranteed" everywhere (also a legal-claim risk) so copy matches the intentional move to "risk-averse."


---



<br>

# PART VIII — Consolidated Action Plan

<sub>Source file: `vierradev.com-audit/ACTION-PLAN.md`</sub>


---

# Vierra SEO Action Plan — Prioritized

Health score today: **81/100**. Closing Phase 1 + 2 should push this to ~90.

## Phase 1 — Critical Fixes (before merging the redesign) — Week 1

| Item | Category | Effort | Files |
|---|---|---|---|
| **Fix the broken Timeline import** — rewire to the new `OnboardingSteps` (or restore `OnboardingModels3D`). Dev build currently throws `Module not found`. | Technical | 30 min | `components/BusinessSection/Timeline.tsx:12,108,198` |
| **Rename duplicate `id="cases"`** (Testimonials → `id="testimonials"`). Invalid HTML that breaks hash-scroll (`app/page.tsx:78-90` relies on `getElementById`). | On-Page | 15 min | `components/WorkSection/CaseStudies.tsx:12`, `components/TestimonialSection/Testimonials.tsx:144` |
| **Wrap all primary content in one `<main>`** (currently only the hero). | On-Page | 30 min | `app/page.tsx:126-321` |
| **Reconcile founding year** (2019 vs 2024). | Content/Schema | 10 min | `public/llms.txt:16` vs `app/layout.tsx:190,261` |

## Phase 2 — High-Impact Improvements — Weeks 2–3

| Item | Category | Effort | Files |
|---|---|---|---|
| **Resolve the NAP location conflict** — Cambridge, MA vs New York, NY. Decide the canonical HQ; if NYC roles are real, add NYC as a distinct location; else fix JobPosting/careers copy. | Schema/Local | 2–3 h | `pages/careers/[slug].tsx:124-132`, `lib/careers.ts:28` vs `app/layout.tsx:169-175` |
| **Fix the split-brand** — migrate `llms.txt`, `manifest.json`, `content/md/index.md` to "Risk-Averse Lead Engine"; drop "guaranteed." | Content/GEO | 1–2 h | `public/llms.txt`, `public/manifest.json:2,4`, `content/md/index.md:2,3,7,13` |
| **Render all client-rotated variants in the DOM** (channel tabs, testimonials, stats) so crawlers/AI see the full offering. | Content/GEO | 3–4 h | `components/BusinessSection/BusinessSolutions.tsx:113`, `TestimonialSection/Testimonials.tsx:140`, `BusinessSection/StatsGrid.tsx:53-69` |
| **Promote visual headings to `<h2>`** — "Scale Your Business" and footer CTA. | On-Page | 20 min | `StatsGrid.tsx:150`, `FooterSection/MainComponent.tsx:88` |
| **Replace the "Coming Soon" case-studies block** with real, quotable results. | Content | varies | `components/WorkSection/CaseStudies.tsx:20-64` |
| **Lengthen short titles** on `/blog`, `/careers`, `/branding`. | On-Page | 30 min | `pages/blog.tsx:162`, `pages/careers.tsx:18`, `pages/branding.tsx:136` |
| **Add OG/Twitter images** to legal + branding pages. | On-Page | 30 min | `privacy-policy.tsx`, `terms-of-service.tsx`, `work-policy.tsx`, `branding.tsx` |
| **Run Lighthouse + pull CrUX** for the redesign; validate mobile INP given animation density. | Performance | 1–2 h | — |

## Phase 3 — Content & Authority — Month 2

| Item | Category | Effort |
|---|---|---|
| Enrich blog author pages (bio, avatar, credentials) and switch schema to `ProfilePage` → `Person`; or `noindex` if kept thin. | Content/Schema | 3–4 h |
| Add `Service`/`OfferCatalog` schema to the homepage. | Schema | 1–2 h |
| Fix blog-listing `publisher.logo` (use `vierra-logo.png` 464×188, not `meta-banner.png`). | Schema | 15 min |
| Wire `/blog` search to the URL param so the `SearchAction` works — or remove it. | Technical | 1–2 h |
| Expand FAQ from 9 to 12–15 Q&A. | Content | 2–3 h |
| Consider dropping bare `LocalBusiness` type unless pursuing map-pack. | Schema | 30 min |
| Per-post OG images for blog. | Images | varies |
| Refactor homepage: page → Server Component, `"use client"` on interactive leaves only. | Performance | 4–8 h |

## Phase 4 — Monitoring & Iteration — Ongoing

| Item |
|---|
| Configure Google APIs (GSC, CrUX, GA4) + optionally DataForSEO to enrich future audits with field CWV, indexation, traffic, backlinks, and live SERP positions. |
| Add a `<noscript>` / hydration-failure fallback so the animated homepage never renders blank. |
| Re-baseline the audit after the redesign ships; track CWV and indexation drift. |
| Add `X-Frame-Options: SAMEORIGIN` (defense-in-depth alongside CSP `frame-ancestors`). |


---
