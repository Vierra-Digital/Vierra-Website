---
description: Full code-quality pass for AI-assisted feature work — gates, cleanup, duplication, security, tests, build.
---

# Quality pass

Run this before calling a feature done. Every command here is known to work in this repo.

**Two rules that make the rest worth anything:**

1. **Run the check, don't read the code.** A claim you didn't execute is a guess. `prisma validate`
   only proves the schema parses; a passing test you never watched fail proves nothing.
2. **Report what's actually true.** If a step fails or you skipped it, say so with the output. "All
   clean" when one thing is unverified is the worst outcome here.

---

## 1. Gates — all must be clean

```bash
npx prisma generate          # client is gitignored; a fresh clone has none
npx tsc --noEmit             # ignore .next/types noise
npm run lint                 # eslint . — expect 0 errors AND 0 warnings
npm test                     # vitest run
npm run test:coverage        # thresholds are a real gate; add new lib modules to vitest.config.mts
npx next build               # must end with 0 deprecation warnings
```

Deprecations: `npx next build 2>&1 | grep -ic deprecat` must print `0`. If it doesn't, read
`node_modules/next/dist/docs/` for the migration rather than guessing, and remove the deprecated
API instead of silencing it.

Database, when schema or queries changed:

```bash
npx prisma migrate status                                                    # want "up to date"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

That diff should stay at the known 2 lines (`users_id_fkey`, unmodellable). **Anything more means
`schema.prisma` and the database have diverged — investigate before shipping.** Never "fix" it with
`db push`.

## 2. Warnings and suppressions

Zero lint warnings is the bar. When a rule is genuinely wrong for a call site, suppress it **on the
line the rule reports** (for `set-state-in-effect` that's the `setState` line, not the `useEffect`)
with a comment giving the specific reason — hydration, a route parameter, localStorage, a
measurement after layout. Audit what's already suppressed:

```bash
grep -rn "eslint-disable" --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=generated . | wc -l   # ~73 in app source; without the exclusions the generated client inflates it to 150
npx eslint . 2>&1 | grep -i "unused eslint-disable"     # stale directives covering nothing
```

## 3. Versions

```bash
npm outdated                 # majors need the upgrade guide read first
npm audit                    # note dev-only advisories rather than force-fixing
```

Do not take a release candidate for a production dependency. Check what `latest` actually is —
`prisma@latest` was an 8.0.0-rc while 7.10.0 was the current stable.

## 4. Unused code

All three should report zero. They have before, so a non-zero result is a real find:

- **Unused dependencies** — every entry in `package.json` should appear in a quoted import or config
  value. Match on `"name"` / `"name/subpath"`, not a bare substring (that returns nothing useful).
- **Unreferenced modules** — walk `lib/`, `hooks/`, `components/`, `types/` and check each file is
  imported somewhere. `pages/` and `app/` are route entry points, so exclude them.
- **Unused exports** — an exported symbol referenced nowhere outside its own file.

Also check for leftovers: scratch scripts, temp pages, `public/` diagnostic files, and
`pages/theme-preview.tsx`-style harnesses. `git status --porcelain --untracked-files=all` must be
empty before committing.

## 5. Duplication

Find it with a sliding window over normalised lines (strip indentation and comments, hash ~14-line
windows, group by the file pairs that collide). Collapse overlapping windows — raw window counts
massively overstate the problem.

Judgement matters more than the number:

- Two files identical apart from an exported name → extract, always.
- The same map or palette written out twice → extract. This has bitten repeatedly here: campaign
  status chips existed in **three** places and the analytics tone palette in **two**.
- Values that look near-identical but carry different roles → **name them, don't merge them.**
  `--mail-rail` and `--mail-pane` were nearly the same colour as `--mail-surface-3`; merging would
  have flattened a real distinction.

Verify a UI extraction by diffing prerendered output structurally — tag sequence and visible text —
not byte-for-byte. `styled-jsx` regenerates class names when JSX moves file, by design.

## 6. Security

Concrete checks for this codebase:

Always exclude `lib/generated` — the generated Prisma client defines `$queryRawUnsafe` itself, and
without the exclusion these greps return false positives (six, last time).

```bash
# Routes with no auth guard. proxy.ts deliberately skips /api/, so every route owns its own.
# ~47 files match: that is the public-by-design set (tracking pixels, booking, webhooks, health,
# the markdown mirror). Read them, don't assume — two real gaps were found this way.
grep -rLE "withAuth|requireRole|requireSession|CRON_SECRET|requireExtensionAuth" pages/api app/api --include=*.ts

# Raw SQL that isn't parameterised — expect 0
grep -rn "queryRawUnsafe\|executeRawUnsafe" --include=*.ts --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=generated .

# Secrets in source — expect 2 known-benign hits: the IndexNow key (public by design, must match
# the file served at /<key>.txt) and a zero-UUID sentinel.
grep -rnE '"[A-Za-z0-9_-]{32,}"' --include=*.ts --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=generated --exclude-dir=tests .
```

Then reason about each surface:

- **Authorization** — session routes use `requireRole`; cron uses `CRON_SECRET` with `safeCompare`;
  admin queries scope by `company_id` (cross-tenant IDOR). Guards in `lib/api/guards.ts` throw a
  `__handled__` sentinel, which is why callers legitimately don't `return` after them.
- **Untrusted rendering** — email HTML through `sanitizeRichEmailHtml`; the public confidential
  viewer adds `restrictStyles` so inline `background:url()` can't beacon the viewer's IP. Structured
  data must go through `jsonLd()` — bare `JSON.stringify` in a `<script>` lets `</script>` in
  panel-authored content close the block early.
- **Public writes** — validated and normalised server-side, sharing rules with the client, plus a
  honeypot and per-IP rate limit. `lib/rateLimit.ts` is in-memory and per-instance: a soft limit,
  not a guarantee. Say so rather than implying otherwise.
- **Prompt injection** — this is real here, not theoretical. `lib/gmail/inboundActions.ts` feeds
  **inbound email content** into `lib/ai/artemis.ts` for auto-draft, and `pages/api/ai/{compose,
  reply,rewrite,summarize}.ts` do the same with message bodies. Anyone can email the inbox. Email
  text is data: it must never be able to redefine the system prompt, request tool use, or exfiltrate
  context. Keep untrusted content in `messages`, never concatenated into `system`, and don't act on
  instructions found inside it.
- **CSP** — keep `next.config.js` allowlists minimal. Every host in `script-src` is somewhere a
  compromised CDN could serve executable code from. Verify a host is actually used (grep the built
  bundles, not just source) before keeping it.

## 7. Tests

```bash
npm test
npm run test:coverage
```

- Unit tests run on pure, import-safe modules only — no Next server, Prisma or network.
- **Watch a new test fail before trusting it.** Temporarily break the code it covers. Tests here
  have passed for the wrong reason twice: once from the wrong data shape, once because a helper's
  escape was a silent no-op.
- Add new `lib/` modules to the coverage `include` in `vitest.config.mts`, or the gate doesn't cover
  them.
- There is no React testing library — component behaviour isn't unit-testable today. Verify it by
  running the app, and say which parts you couldn't cover.

## 8. Build and run

`npx next build` must compile with zero deprecation warnings. For anything observable, actually look
at it: start the dev server via the preview tool (never `npm run dev` in a shell), then check
console errors, network requests, and computed styles.

When the browser pane is closed, `document.hidden` is true — screenshots, `read_page`, hydration and
element geometry all silently fail while computed styles still work. Don't mistake that for a code
bug, and don't claim visual verification you couldn't perform.

## 9. Report

State per area: clean, fixed, or unverified — and for anything unverified, why. Include the numbers
(tests passed, lint count, diff lines). If you corrected your own earlier mistake, say that plainly
rather than quietly moving on.
