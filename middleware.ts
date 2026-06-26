import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Markdown mirror routing.
 *
 * Appending `.md` to any public content URL returns a clean Markdown version of
 * the page (for LLMs, agents, and plain-text consumers). The request is
 * rewritten to the /api/md handler, which produces the Markdown.
 *
 *   /                     -> /index.md
 *   /branding             -> /branding.md
 *   /blog/some-post       -> /blog/some-post.md
 *
 * The visible HTML pages are untouched — this only intercepts the `.md` suffix.
 */
const SITE_URL = "https://vierradev.com";

/** Returns the `.md` mirror path for a content page, or null if none exists. */
function mirrorPathFor(pathname: string): string | null {
  if (pathname === "/") return "/index.md";
  const STATIC = ["/branding", "/terms-of-service", "/privacy-policy", "/work-policy", "/blog", "/careers", "/faq"];
  if (STATIC.includes(pathname)) return `${pathname}.md`;
  if (pathname.startsWith("/blog/")) return `${pathname}.md`;
  if (pathname.startsWith("/careers/")) return `${pathname}.md`;
  return null;
}

/** Copies Set-Cookie entries from a source response onto a target response. */
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Refresh the Supabase session cookie on every matched request — required by
  // @supabase/ssr so expiring tokens get renewed before any page/route reads them.
  let refreshed = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          refreshed = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => refreshed.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.getUser();

  // /llms.txt — index of Markdown mirrors for AI agents and tools.
  if (pathname === "/llms.txt") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/md";
    url.search = "";
    const headers = new Headers(req.headers);
    headers.set("x-md-path", "__llms__");
    return carryCookies(refreshed, NextResponse.rewrite(url, { request: { headers } }));
  }

  if (pathname.endsWith(".md")) {
    // Strip the trailing ".md" and the leading "/" to recover the route key.
    const route = pathname.slice(0, -".md".length).replace(/^\/+/, "");

    // Rewrite to the handler, passing the route via a request header.
    // (Neither dynamic segments nor added query params survive a middleware
    // rewrite onto an optional catch-all reliably, but request headers do.)
    const url = req.nextUrl.clone();
    url.pathname = "/api/md";
    url.search = "";
    const headers = new Headers(req.headers);
    headers.set("x-md-path", route === "" ? "index" : route);
    return carryCookies(refreshed, NextResponse.rewrite(url, { request: { headers } }));
  }

  // For content pages, advertise the Markdown mirror via a Link header so
  // crawlers and AI fetchers can discover it.
  const mdPath = mirrorPathFor(pathname);
  if (mdPath) {
    refreshed.headers.set(
      "Link",
      `<${SITE_URL}${mdPath}>; rel="alternate"; type="text/markdown"`
    );
    return refreshed;
  }

  return refreshed;
}

export const config = {
  // Run on page-like requests only; skip Next internals, the API, and static files.
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
