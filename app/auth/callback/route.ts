import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveUser } from "@/lib/auth/resolveUser";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;

  // Optional post-exchange override (e.g. a self-service recovery link needs to
  // land on the set-password form, not the role-based landing page). Only a
  // same-origin relative path is honored, to avoid an open redirect.
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !/^\/[/\\]/.test(nextParam) ? nextParam : null;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  // Reuse a single response object so cookies written by `setAll` during the
  // code exchange land on the response we actually return — we only learn the
  // final redirect destination after exchanging the code, so we patch the
  // Location header in place rather than building a second response and
  // copying cookies (which would drop their httpOnly/sameSite/maxAge options).
  const response = NextResponse.redirect(new URL("/login?error=oauth", origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return response;
  }

  if (next) {
    response.headers.set("Location", new URL(next, origin).toString());
    return response;
  }

  const resolved = await resolveUser(supabase, data.user);
  const destination =
    resolved.kind === "member" ? "/panel" : resolved.kind === "client" ? "/client" : "/onboarding/start";
  response.headers.set("Location", new URL(destination, origin).toString());
  return response;
}
