import { createServerClient } from "@supabase/ssr";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

/**
 * Supabase server client for Pages Router (API routes + getServerSideProps).
 * `req`/`res` are typed loosely so this works for both NextApiRequest/Response
 * and the IncomingMessage/ServerResponse pair GSSP context provides.
 */
export function createSupabasePagesClient(req: any, res: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const parsed = parseCookie(req.headers?.cookie || "");
          return Object.entries(parsed).map(([name, value]) => ({ name, value: value ?? "" }));
        },
        setAll(cookiesToSet, headers) {
          if (cookiesToSet.length > 0) {
            res.setHeader(
              "Set-Cookie",
              cookiesToSet.map(({ name, value, options }) => serializeCookie(name, value, options))
            );
          }
          for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
          }
        },
      },
    }
  );
}
