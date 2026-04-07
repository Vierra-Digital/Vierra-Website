/**
 * Single Google OAuth Web client for NextAuth, Gmail connect, and token refresh.
 * Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET only.
 */

function trimEnv(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveGoogleWebClientCredentials() {
  const clientId = trimEnv(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = trimEnv(process.env.GOOGLE_CLIENT_SECRET);
  return { clientId, clientSecret };
}
