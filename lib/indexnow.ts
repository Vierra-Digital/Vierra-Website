/**
 * IndexNow — instant indexing notifications for Bing, Yandex, Naver, Seznam
 * (and, via Bing's index, Microsoft Copilot). Ping the API whenever a public
 * URL is created or updated so search engines re-crawl immediately instead of
 * waiting for their next scheduled crawl.
 *
 * The key is public by design and must match the file served at
 *   https://vierradev.com/<INDEXNOW_KEY>.txt
 */
const INDEXNOW_KEY = "20da89a78e0eb699b9a79f47ffb3afc1";
const HOST = "vierradev.com";
const SITE_URL = `https://${HOST}`;

/**
 * Notify IndexNow about changed URLs. Accepts absolute URLs or site-relative
 * paths (e.g. "/blog/my-post"). Best-effort: only runs in production and never
 * throws — a failed ping must not break the publish flow.
 */
export async function notifyIndexNow(urlsOrPaths: string[]): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const urlList = Array.from(
    new Set(
      urlsOrPaths
        .filter(Boolean)
        .map((u) => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`))
    )
  );
  if (urlList.length === 0) return;

  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
  } catch (e) {
    console.warn("IndexNow submission failed (non-fatal):", e);
  }
}
