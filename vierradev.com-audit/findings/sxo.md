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
