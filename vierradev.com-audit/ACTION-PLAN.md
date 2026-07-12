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
