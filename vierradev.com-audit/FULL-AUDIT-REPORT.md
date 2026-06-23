# Full SEO Audit — vierradev.com

**Date:** 2026-06-23
**Auditor:** Claude Code (`seo-audit` skill, inline mode)
**Stack detected:** Next.js (mixed App Router + Pages Router) · Netlify Edge + Cloudflare · Brotli
**Business type:** B2B digital marketing / lead-generation agency (service business, light local signals)

---

## Executive Summary

### Overall SEO Health Score: **82 / 100** — Strong

vierradev.com is a well-engineered marketing site with **excellent fundamentals**: comprehensive meta and Open Graph tags, rich structured data (Organization, WebSite, ProfessionalService/LocalBusiness, JobPosting), a hardened security-header stack, clean canonicalization, and **best-in-class AI-search readiness** (`llms.txt` + per-page `.md` mirrors + explicitly allowed AI crawlers). The score is held back by one **critical issue** — the blog index returns HTTP 503 while also being in the sitemap — and a thin content footprint (no live blog posts).

### Score by Category

| Category | Weight | Score | Notes |
|----------|:------:|:-----:|-------|
| Technical SEO | 22% | 78 | Strong headers/redirects; **/blog 503** drags it down |
| Content Quality | 23% | 72 | Clear value prop & E-E-A-T; **blog empty** |
| On-Page SEO | 20% | 90 | Near-exemplary meta/headings/alt |
| Schema / Structured Data | 10% | 88 | Rich; `validThrough` missing on JobPosting |
| Performance (CWV) | 10% | 80 | Lean & compressed; no field data available |
| AI Search Readiness | 10% | 95 | llms.txt, .md mirrors, AI crawlers allowed |
| Images | 5% | 78 | 100% alt; **1.26 MB OG image** |

### Top 5 Critical / High Issues
1. **`/blog` returns HTTP 503** (`Retry-After: 3600`) — persistent across retries. *(Critical)*
2. **Sitemap ↔ index conflict:** `/blog` is in the sitemap at priority 0.9 / `changefreq: daily`, but the page is `noindex, nofollow` **and** 503. *(Critical)*
3. **Blog has no live posts** — `blog.md` returns "_No posts found._" A lead-gen agency with an empty blog forfeits its biggest organic + AI-citation channel. *(High)*
4. **OG/social image is a 1.26 MB PNG** (`/assets/meta-banner.png`) — slow social unfurls, wasteful. *(High)*
5. **`JobPosting` schema missing `validThrough`** — Google Jobs may drop or de-prioritize listings without an expiry. *(High)*

### Top 5 Quick Wins
1. Add `validThrough` to every `JobPosting` (one field).
2. Compress `meta-banner.png` → WebP/optimized PNG (~150–250 KB target).
3. Resolve the `/blog` ↔ sitemap contradiction (remove from sitemap until live, or fix the 503).
4. De-duplicate the two `How Does It Work?` `<h2>`s on the homepage.
5. Ship a proper `apple-touch-icon` (180×180 PNG) instead of reusing `favicon.ico`.

---

## 1. Technical SEO — 78/100

**What works**
- HTTPS enforced: `http://` → `https://` (1 hop), `www` → apex (1 hop), trailing slash normalized.
- Proper **404** status on unknown URLs (no soft-404).
- Robust security headers: `Content-Security-Policy` (scoped), `Strict-Transport-Security` (2yr + preload-ready + includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- `robots.txt` is clean and intentional — disallows app/admin/auth paths, allows public + blog, declares the sitemap, and **explicitly allows AI crawlers** (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended).
- HTML served with **Brotli**; prerendered (`X-Nextjs-Prerender: 1`) so content is in source HTML (not client-only).

**Findings**
- **[Critical] `/blog` → HTTP 503** with `Retry-After: 3600`, reproducible across 3 requests. No `X-Nextjs-*` headers on the response → failing at the Netlify/data layer (likely the external blog API `vierra-server.vercel.app`, which itself returns 200 but yields no posts). Search engines treat persistent 503 as "down" and will drop the URL.
- **[Critical] Sitemap/indexability contradiction:** `/blog` is listed in `sitemap.xml` (priority 0.9, `changefreq: daily`) yet the page emits `<meta name="robots" content="noindex, nofollow">` and 503s. Conflicting signals waste crawl budget and erode trust in the sitemap.
- **[Low] Mixed Next.js routers:** homepage/careers use the App Router; `/blog` uses the Pages Router (`data-next-head`). Not harmful per se, but inconsistent rendering paths increase maintenance/regression risk.

---

## 2. Content Quality & E-E-A-T — 72/100

**What works**
- Crisp, benefit-led value proposition ("Risk-Averse, Guaranteed Leads").
- E-E-A-T signals present: named clients (Isenberg/UMass, Iron & Water Co., HappyStack, Somerville Dental), named testimonial authors, a leadership team section, founding date in schema.
- Homepage content is server-rendered and mirrored cleanly in `index.md`.

**Findings**
- **[High] Empty blog.** `blog.md` → "_No posts found._" For a lead-gen/marketing agency, the blog is the primary vehicle for ranking on informational queries and for being cited by AI assistants. Currently zero topical content is published.
- **[Medium] Thin homepage body (~635 words).** Acceptable for a landing page, but more substantive, query-targeted copy (or supporting pages) would broaden keyword coverage.
- **[Low] No author/organization E-E-A-T pages** beyond the team block — an "About"/authorship hub would strengthen authority signals once the blog is live.

---

## 3. On-Page SEO — 90/100

**What works**
- `<title>`: *"Vierra | Risk-Averse Guaranteed Leads For Your Business"* — branded, keyword-rich, good length.
- `<meta name="description">` present and compelling; `keywords` present (harmless).
- `<meta name="robots" content="index, follow">` on indexable pages; per-page **self-referential canonicals** verified (home, careers, job pages).
- Exactly **one `<h1>`**; logical `h2`/`h3` hierarchy (8× h2, 11× h3).
- Descriptive, branded titles across `/careers`, job pages, `/privacy-policy`, `/branding`.

**Findings**
- **[Low] Duplicate `<h2>` "How Does It Work?"** appears twice on the homepage — de-duplicate or differentiate (e.g., desktop/mobile variants should not both render to DOM).

---

## 4. Schema / Structured Data — 88/100

**What works**
- **Homepage:** `Organization` (with `legalName`, `logo`, `address`, `contactPoint`, `sameAs`, `foundingDate`), `WebSite` (with `potentialAction`/SearchAction), and `ProfessionalService`/`LocalBusiness` (with `geo`, `telephone`, `address`).
- **Career pages:** valid `JobPosting` with `title`, `datePosted`, `hiringOrganization`, `jobLocation` (`Place`/`PostalAddress`), `employmentType`, and `baseSalary` (`MonetaryAmount`/`QuantitativeValue`), plus a `BreadcrumbList`.

**Findings**
- **[High] `JobPosting` missing `validThrough`.** Google for Jobs strongly recommends an expiry date; without it, postings can be silently expired or down-ranked.
- **[Low] Verify `LocalBusiness` accuracy.** Since Vierra reads as a B2B service (not a walk-in location), confirm the `address`/`geo`/`telephone` are correct and that `LocalBusiness` is the intended type (vs. `ProfessionalService` alone) to avoid mismatched local signals.

---

## 5. Performance (Core Web Vitals) — 80/100

> **Note:** PageSpeed Insights API returned **HTTP 429** (rate-limited; no API key configured), so lab Lighthouse and CrUX **field data could not be retrieved**. Score below is a heuristic from payload analysis. Confirm with Google Search Console → Core Web Vitals, or configure a PSI/CrUX API key (the `seo-google` skill supports this).

**What works (heuristic)**
- Lean head: 4 scripts, 1 render-blocking stylesheet, with `preconnect`, `preload`, and `dns-prefetch` hints.
- **Brotli** compression on HTML.
- 14 of 15 images `loading="lazy"`; `next/image` responsive optimization in use.
- Self-hosted `woff2` fonts (no third-party font origin).

**Findings**
- **[Medium] Heavy images inflate transfer** — `meta-banner.png` 1.26 MB; team headshots are PNG photos (Alex.png 131 KB source; ~206 KB even after `next/image` at w=640) where WebP/AVIF would cut weight substantially.
- **[Info] GA via `gtag.js`** loaded `async` — minimal main-thread risk, but it is third-party JS; keep an eye on TBT/INP once field data is available.

---

## 6. Images — 78/100

**What works**
- **100% alt-text coverage** (15/15 images have non-empty `alt`).
- Lazy loading + `next/image` responsive `srcset`.
- OG image declares `width`/`height`/`alt`/`type`.

**Findings**
- **[High] OG image oversized:** `/assets/meta-banner.png` = **1,287,476 bytes (~1.26 MB)** PNG. Target ~150–250 KB (WebP or optimized PNG) for fast, reliable social unfurls.
- **[Medium] Photographic assets shipped as PNG** — convert team/partner photos to WebP/AVIF.
- **[Low] `apple-touch-icon` reuses `favicon.ico`** (16×16, x-icon). Provide a dedicated 180×180 PNG.
- **[Info] `/assets/Team/Michael.png` 404s on production** (returns HTML 404). Matches the uncommitted working tree (`Team.tsx` modified, `Michael.png` untracked). Ensure the asset is committed/deployed with the Team change to avoid a broken image.

---

## 7. AI Search Readiness (GEO) — 95/100

**What works — exemplary**
- **`llms.txt`** present, well-structured, with section grouping and `.md` deep links.
- **Per-page Markdown mirrors** (`index.md`, `branding.md`, `blog.md`, legal pages) advertised via `Link: rel="alternate" type="text/markdown"` header — ideal for LLM ingestion and citation.
- **AI crawlers explicitly allowed** in robots.txt (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended).
- Clean, passage-friendly content structure with declarative claims and named entities.

**Findings**
- **[Medium] Citable content is shallow** — GEO infrastructure is excellent, but with an empty blog there is little substantive content for AI engines to cite. The payoff from this strong foundation is gated on publishing real articles.

---

## Methodology & Limitations
- Live HTTP analysis via `curl` (headers, status chains, redirects, robots, sitemap, llms.txt, schema, on-page parsing, asset sizes). Rendered/source HTML inspected directly (site is prerendered).
- **Not covered:** Lighthouse lab metrics & CrUX field CWV (PSI API rate-limited, no key); full 500-page crawl (sitemap lists 15 URLs — small site, effectively complete); backlink profile (no Moz/Bing/DataForSEO credentials); GSC/GA4 (no Google API credentials).
- To enrich: configure a Google API key and re-run with the `seo-google` skill for real field CWV, indexation, and traffic data.
