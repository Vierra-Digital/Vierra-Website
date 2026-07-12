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
