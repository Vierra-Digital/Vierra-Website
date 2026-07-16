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

export function scrollToHomeSection(sectionId: string): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/") {
    scrollWindowToSection(sectionId, true);
    return;
  }
  try {
    sessionStorage.setItem(SECTION_SCROLL_KEY, sectionId);
  } catch {
    /* sessionStorage blocked — fall through to a plain home navigation */
  }
  window.location.href = "/";
}
