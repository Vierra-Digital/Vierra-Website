#!/usr/bin/env bash
# Netlify "ignore" hook: exit 0 to SKIP the build, non-zero to BUILD.
#
# Netlify bills per build minute in every context, and a deploy preview runs on every push to every
# open PR. Pushes that cannot change the deployed site (tests, CI config, docs, editor settings)
# were each costing a full build for no deployable difference.
#
# Conservative by construction: the build is skipped only when EVERY changed path matches the
# non-deployable list, and any unexpected git state falls through to building.
set -uo pipefail

# CACHED_COMMIT_REF is the last successfully built commit; COMMIT_REF is the candidate.
BASE="${CACHED_COMMIT_REF:-}"
HEAD_REF="${COMMIT_REF:-HEAD}"

# No known baseline (first build on a branch, or a cleared cache) → always build.
if [ -z "$BASE" ]; then
  echo "ignore: no CACHED_COMMIT_REF — building."
  exit 1
fi

CHANGED="$(git diff --name-only "$BASE" "$HEAD_REF" 2>/dev/null)" || {
  echo "ignore: could not diff $BASE..$HEAD_REF — building to be safe."
  exit 1
}

if [ -z "$CHANGED" ]; then
  echo "ignore: no file changes — skipping."
  exit 0
fi

# Paths that cannot affect the built site. Deliberately narrow — netlify.toml, package files,
# next.config, the Prisma schema, and everything under app/ pages/ components/ lib/ public/ styles/
# are all absent, so a change to any of them builds.
NON_DEPLOYABLE='^(tests/|\.github/|\.vscode/|\.idea/|docs/|\.claude/|vitest\.config\.ts$|\.coderabbit\.yaml$|README\.md$|CONTRIBUTING\.md$|LICENSE$|\.gitignore$|netlify-ignore\.sh$|.*\.test\.ts$)'

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if ! echo "$file" | grep -Eq "$NON_DEPLOYABLE"; then
    echo "ignore: '$file' can affect the build — building."
    exit 1
  fi
done <<< "$CHANGED"

echo "ignore: only non-deployable paths changed — skipping build."
echo "$CHANGED" | sed 's/^/  - /'
exit 0
