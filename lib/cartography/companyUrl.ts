/** cartography_companies.domain is a bare host (see lib/enrichment/companyContext.ts's
 * keyless resolution) — never a full URL — so every UI surface needs the same https://
 * prefix. Shared by the Search/Agentic result rows and the Review Queue. */
export function companyUrl(domain: string | null): string | null {
  return domain ? `https://${domain}` : null;
}
