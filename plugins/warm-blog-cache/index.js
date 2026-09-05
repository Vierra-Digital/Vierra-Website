// Post-deploy cache warmer for the blog.
//
// The blog pages are ISR (`revalidate`), and Netlify drops the ISR cache on
// every deploy. That makes the *first* visitor to each blog page after a deploy
// trigger a live regeneration (cold function + cold Supabase connection), which
// is the multi-second "slow on first click after I deploy" delay.
//
// This runs in `onSuccess` — after the new deploy is published and live — and
// fetches the blog index plus each recent post URL once. That regeneration cost
// is paid here, by the build, so the first real visitor lands on a warm cache.
//
// It is intentionally best-effort: any failure is logged and swallowed so a slow
// or unreachable page can never fail the deploy.

const REQUEST_TIMEOUT_MS = 15_000; // per page; cold regen + cold DB can be slow
// Warming ran sequentially over up to 30 posts, which was ~50s of billed build time — about a
// third of the whole production build. Traffic is heavily concentrated on the newest posts, and
// anything not warmed here simply regenerates on its first visit (the pre-existing behaviour), so
// warming fewer pages with a little concurrency costs a fraction of the minutes for nearly all of
// the benefit.
const MAX_POSTS = 8;
const WARM_CONCURRENCY = 4;

async function warm(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "vierra-cache-warmer" },
    });
    // Drain the body so the regeneration fully completes server-side.
    await res.text();
    console.log(`  warmed ${res.status} in ${Date.now() - startedAt}ms  ${url}`);
    return res.ok;
  } catch (err) {
    console.log(`  skipped (${err.name || "error"}) ${url}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Pull recent post slugs from the RSS feed so the plugin needs no DB access of
// its own. The feed lists canonical vierradev.com URLs; we only keep the slug
// and rebuild it against the deploy we're actually warming.
async function discoverSlugs(base) {
  try {
    const res = await fetch(`${base}/blog/rss.xml`, {
      headers: { "user-agent": "vierra-cache-warmer" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const slugs = new Set();
    const re = /\/blog\/([a-z0-9][a-z0-9-]*)(?=[<"\s])/gi;
    let m;
    while ((m = re.exec(xml)) !== null) {
      if (m[1] !== "rss.xml") slugs.add(m[1]);
    }
    return [...slugs].slice(0, MAX_POSTS);
  } catch {
    return [];
  }
}

module.exports = {
  onSuccess: async ({ utils }) => {
    // Only warm real production deploys — preview/branch deploys aren't what
    // users hit, and warming them just burns build minutes.
    if (process.env.CONTEXT && process.env.CONTEXT !== "production") {
      console.log(`warm-blog-cache: skipping (context=${process.env.CONTEXT})`);
      return;
    }

    // DEPLOY_URL points at the exact deploy just published and shares its
    // function/ISR cache with the production alias, so warming it warms what
    // visitors get. Fall back to the site's primary URL.
    const base = (process.env.DEPLOY_URL || process.env.URL || "").replace(/\/$/, "");
    if (!base) {
      console.log("warm-blog-cache: no deploy URL available, skipping");
      return;
    }

    console.log(`warm-blog-cache: warming blog cache on ${base}`);
    try {
      await warm(`${base}/blog`);
      const slugs = await discoverSlugs(base);
      console.log(`warm-blog-cache: warming ${slugs.length} post(s), ${WARM_CONCURRENCY} at a time`);
      // Bounded concurrency rather than one-at-a-time: even with connection_limit=1 serializing the
      // DB, requests still overlap on function cold-start and network, so wall time drops sharply.
      // The cap keeps it from bursting the cold function.
      const startedAt = Date.now();
      const queue = [...slugs];
      await Promise.all(
        Array.from({ length: Math.min(WARM_CONCURRENCY, queue.length) }, async () => {
          for (let slug = queue.shift(); slug !== undefined; slug = queue.shift()) {
            await warm(`${base}/blog/${slug}`);
          }
        })
      );
      console.log(`warm-blog-cache: done in ${Date.now() - startedAt}ms`);
    } catch (err) {
      // Never fail the deploy over cache warming.
      console.log(`warm-blog-cache: non-fatal error: ${err && err.message}`);
      if (utils && utils.status) {
        utils.status.show({
          title: "Blog cache warm skipped",
          summary: "Warming hit an error; deploy is unaffected.",
        });
      }
    }
  },
};
