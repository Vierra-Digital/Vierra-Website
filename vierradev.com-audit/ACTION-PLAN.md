# Action Plan — vierradev.com

Prioritized fixes from the 2026-06-23 audit. Health score: **82/100**.

## Phase 1 — Critical (this week)

- [ ] **Fix `/blog` 503.** It's reproducible (`Retry-After: 3600`) with no `X-Nextjs-*` headers → failing at the data/SSR layer, likely the external blog API (`vierra-server.vercel.app`). Make the page degrade gracefully to a 200 "no posts yet" state instead of 503.
- [ ] **Resolve sitemap ↔ index conflict.** `/blog` is in `sitemap.xml` (priority 0.9, daily) but emits `noindex, nofollow` + 503. Either (a) remove `/blog` from the sitemap until it's live and indexable, or (b) once posts exist, drop the `noindex` and ensure a 200.

## Phase 2 — High-Impact (weeks 2–3)

- [ ] **Add `validThrough` to all `JobPosting` schema** (every `/careers/*` page). Required-recommended by Google for Jobs.
- [ ] **Optimize the OG image.** Convert `/assets/meta-banner.png` (1.26 MB) to WebP or an optimized PNG, target ~150–250 KB. Keep 1200×630.
- [ ] **Publish initial blog content.** Even 3–5 cornerstone articles (case studies, lead-gen guides) activate the strongest unused asset — organic rankings *and* AI citations (the `.md`/`llms.txt` plumbing is already built).

## Phase 3 — Content & Authority (month 2)

- [ ] **Convert photographic PNGs to WebP/AVIF** (team & partner images).
- [ ] **De-duplicate the "How Does It Work?" `<h2>`** on the homepage.
- [ ] **Add a dedicated `apple-touch-icon`** (180×180 PNG).
- [ ] **Verify `LocalBusiness` data** (address/geo/telephone) is accurate, or narrow to `ProfessionalService` if Vierra isn't a walk-in location.
- [ ] **Expand homepage / add supporting pages** to broaden keyword coverage beyond ~635 words.
- [ ] **Ship `Michael.png`** with the in-progress Team change (currently untracked → 404s on prod).

## Phase 4 — Monitoring & Iteration (ongoing)

- [ ] **Configure a Google API key** and re-run with `seo-google` for real CrUX field CWV, GSC indexation, and GA4 organic traffic.
- [ ] **Capture an SEO drift baseline** (`seo-drift`) so future deploys can be diff'd for regressions (e.g., to catch the next accidental `noindex` or 503).
- [ ] **Re-run this audit** after Phase 1–2 to confirm the blog is healthy and re-score.
- [ ] **Build out topic clusters** (`seo-cluster`) once a few posts exist, to plan a hub-and-spoke content architecture.
