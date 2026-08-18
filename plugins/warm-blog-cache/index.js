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

const REQUEST_TIMEOUT_MS = 25_000; // per page; cold regen + cold DB can be slow
const MAX_POSTS = 30; // bound the work as the post count grows

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
      console.log(`warm-blog-cache: warming ${slugs.length} post(s)`);
      // Sequential: connection_limit=1 serializes DB work anyway, and this is
      // gentler on the cold function than a burst of parallel requests.
      for (const slug of slugs) {
        await warm(`${base}/blog/${slug}`);
      }
      console.log("warm-blog-cache: done");
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
