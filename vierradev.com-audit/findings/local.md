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
