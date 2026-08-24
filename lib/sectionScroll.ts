/**
 * Scroll to a homepage section WITHOUT ever putting a #hash in the URL.
 *
 * - On the homepage: smooth-scroll to the section right away.
 * - From any other page: stash the target in sessionStorage and navigate to a
 *   clean "/". The homepage reads and consumes the target on mount (see
 *   app/home-client.tsx), so the URL stays "/" the whole time.
 */
export const SECTION_SCROLL_KEY = "vierra_scroll_target";

/**
 * Scroll the window so `sectionId` aligns to the top. Uses window.scrollTo (more
 * reliable across environments than Element.scrollIntoView). Returns false if the
 * target isn't in the DOM yet (it may be lazy-loaded).
 */
export function scrollWindowToSection(sectionId: string, smooth = true): boolean {
  if (typeof window === "undefined") return false;
  const el = document.getElementById(sectionId);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY;
  // "instant" (not "auto") so it bypasses the page's CSS `scroll-behavior: smooth`
  // when we need a direct jump (e.g. landing on the section after a page load).
  window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
  return true;
}

/**
 * Scroll to a section of the home page, from anywhere.
 *
 * On the home page this scrolls directly. From another page it stores the target and navigates
 * home, where the restore effect picks it up.
 *
 * `navigateHome` lets a caller hand in Next's router so that hop is a client-side transition
 * instead of a full document load — the same reason the lint rule objects to assigning
 * location.href for an internal page. It stays optional: this module is imported by plain
 * functions as well as components, and a full load is a correct, if slower, fallback.
 */
export function scrollToHomeSection(sectionId: string, navigateHome?: (path: string) => void): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/") {
    scrollWindowToSection(sectionId, true);
    return;
  }
  try {
    sessionStorage.setItem(SECTION_SCROLL_KEY, sectionId);
  } catch {
    /* sessionStorage blocked — the navigation still happens, just without the scroll */
  }
  if (navigateHome) {
    navigateHome("/");
    return;
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}
