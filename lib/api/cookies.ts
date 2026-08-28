import { parseCookie, stringifySetCookie, type SetCookie } from "cookie";

export { parseCookie };

/** Everything `SetCookie` accepts except the name and value, which are positional below. */
type SerializeOptions = Omit<SetCookie, "name" | "value">;

/**
 * Serialise a Set-Cookie header value.
 *
 * cookie 2 removed the `serialize(name, value, options)` signature — `stringifySetCookie` now takes
 * a single object. Sixteen call sites here pass security attributes (httpOnly, sameSite, secure,
 * path, maxAge) as that third argument, and rewriting each one by hand is sixteen chances to drop
 * or mistype an attribute on an authentication cookie. This adapter keeps the positional signature
 * so those call sites are untouched, and the mapping to the object form exists in exactly one place
 * that can be tested.
 *
 * Verified against cookie 1's `serialize` output: identical strings for Secure on and off,
 * SameSite, Path, and Max-Age including 0. See tests/cookies.test.ts.
 */
export function serializeCookie(name: string, value: string, options: SerializeOptions = {}): string {
  return stringifySetCookie({ name, value, ...options });
}
