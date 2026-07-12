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
