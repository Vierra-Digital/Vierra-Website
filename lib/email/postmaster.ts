/**
 * Google Postmaster Tools — the only real source for spam-complaint rate and domain reputation.
 *
 * Spam complaints genuinely cannot be derived from our own data: a recipient hitting "Report spam"
 * tells Gmail, not us. Postmaster Tools is Google's feedback channel for that, and it also reports
 * SPF/DKIM/DMARC pass rates as *observed by Gmail*, which is stronger evidence than the DNS record
 * check in /api/email/domain-auth (that proves records exist; this proves mail is passing).
 *
 * Two prerequisites are outside this codebase, so every failure path here is non-fatal and
 * self-describing rather than an error:
 *   1. The domain must be registered + verified in Postmaster Tools by whoever owns its DNS.
 *   2. The connected Google account must have granted `postmaster.readonly`.
 *
 * API: https://developers.google.com/gmail/postmaster
 */

const POSTMASTER_BASE = "https://gmailpostmastertools.googleapis.com/v1";

/** Why a domain has no data — surfaced verbatim so the UI can tell the user what to fix. */
export type PostmasterUnavailableReason = "not_registered" | "no_permission" | "no_data" | "error";

export type PostmasterDomainStats = {
  domain: string;
  /** ISO date of the most recent day with data. */
  date: string;
  /** Fraction of delivered mail users marked as spam (Google's own number). */
  userReportedSpamRatio: number | null;
  /** Google's coarse reputation bucket for the domain. */
  domainReputation: string | null;
  /** Pass rates as OBSERVED BY GMAIL — stronger than "the DNS record exists". */
  spfSuccessRatio: number | null;
  dkimSuccessRatio: number | null;
  dmarcSuccessRatio: number | null;
};

export type PostmasterResult =
  | { ok: true; stats: PostmasterDomainStats }
  | { ok: false; domain: string; reason: PostmasterUnavailableReason; message: string };

/** Postmaster wants YYYYMMDD path segments. */
function yyyymmdd(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

const asRatio = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Fetch the most recent traffic stats for one domain.
 *
 * Postmaster publishes with a lag and only for days with enough volume, so we walk back a few days
 * rather than assuming "yesterday" exists — otherwise a low-volume sender always looks like it has
 * no data at all.
 */
export async function fetchPostmasterStats(
  domain: string,
  accessToken: string,
  lookbackDays = 5
): Promise<PostmasterResult> {
  const cleanDomain = domain.trim().toLowerCase();
  if (!cleanDomain) {
    return { ok: false, domain, reason: "error", message: "No domain supplied." };
  }

  for (let daysAgo = 1; daysAgo <= lookbackDays; daysAgo += 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const url = `${POSTMASTER_BASE}/domains/${encodeURIComponent(cleanDomain)}/trafficStats/${yyyymmdd(day)}`;

    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch {
      return { ok: false, domain: cleanDomain, reason: "error", message: "Could not reach Postmaster Tools." };
    }

    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: true,
        stats: {
          domain: cleanDomain,
          date: day.toISOString().slice(0, 10),
          userReportedSpamRatio: asRatio(payload.userReportedSpamRatio),
          domainReputation: typeof payload.domainReputation === "string" ? payload.domainReputation : null,
          spfSuccessRatio: asRatio(payload.spfSuccessRatio),
          dkimSuccessRatio: asRatio(payload.dkimSuccessRatio),
          dmarcSuccessRatio: asRatio(payload.dmarcSuccessRatio),
        },
      };
    }

    // 404 = no stats for THAT day; keep walking back before concluding anything.
    if (response.status === 404) continue;

    if (response.status === 403) {
      return {
        ok: false,
        domain: cleanDomain,
        reason: "no_permission",
        message:
          "Not authorized. Reconnect this Google account to grant Postmaster access, and confirm the domain is verified in Postmaster Tools.",
      };
    }
    if (response.status === 401) {
      return { ok: false, domain: cleanDomain, reason: "no_permission", message: "Google rejected the token — reconnect the account." };
    }
    return {
      ok: false,
      domain: cleanDomain,
      reason: "error",
      message: `Postmaster Tools returned ${response.status}.`,
    };
  }

  return {
    ok: false,
    domain: cleanDomain,
    reason: "no_data",
    message:
      "No Postmaster data for the last few days. Google only publishes stats above a daily volume threshold, and the domain must be verified in Postmaster Tools.",
  };
}

/**
 * Interpretation of a spam rate, so the UI isn't just showing a bare number. Google's published
 * guidance is to stay under 0.10%, and treats 0.30% as the point where delivery suffers.
 */
export function spamRateVerdict(ratio: number | null): { level: "good" | "warn" | "bad" | "unknown"; note: string } {
  if (ratio === null) return { level: "unknown", note: "No spam-rate data yet." };
  const pctValue = ratio * 100;
  if (pctValue < 0.1) return { level: "good", note: "Below Google's 0.10% guidance." };
  if (pctValue < 0.3) return { level: "warn", note: "Above 0.10% — tighten targeting before it bites." };
  return { level: "bad", note: "At or above 0.30% — Gmail will be throttling or spam-foldering." };
}
