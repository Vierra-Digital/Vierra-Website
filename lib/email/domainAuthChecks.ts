import { promises as dns } from "dns";

/**
 * SPF/DKIM/DMARC checks shared between `/api/email/domain-auth` (all-domains overview) and
 * `/api/email/accounts/[id]/health` (single-mailbox health row). Pure DNS lookups, nothing stored.
 */

export type RecordStatus = "pass" | "warn" | "fail";

export type CheckResult = { status: RecordStatus; detail: string };
export type DmarcCheckResult = CheckResult & { policy: string | null };

/** All TXT records at `name`, each joined from its character-string chunks. "" on any DNS error. */
export async function txtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export async function checkSpf(domain: string): Promise<CheckResult> {
  const records = (await txtRecords(domain)).filter((r) => r.toLowerCase().startsWith("v=spf1"));
  if (records.length === 0) {
    return { status: "fail", detail: "No SPF record found. Receivers can't verify your senders." };
  }
  if (records.length > 1) {
    // More than one SPF record is a hard failure per RFC 7208 — receivers treat it as permerror.
    return { status: "fail", detail: "Multiple SPF records — receivers treat this as an error. Merge into one." };
  }
  const record = records[0];
  if (/[?~]all\s*$/.test(record)) {
    return { status: "warn", detail: "SPF ends in ~all/?all (soft). Tighten to -all once senders are confirmed." };
  }
  return { status: "pass", detail: "SPF record published." };
}

/** Gmail/Workspace publishes DKIM under the `google` selector; check a few common ones too. */
const DKIM_SELECTORS = ["google", "default", "selector1", "selector2", "k1", "mail"];

export async function checkDkim(domain: string): Promise<CheckResult> {
  const found: string[] = [];
  await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      const records = await txtRecords(`${selector}._domainkey.${domain}`);
      if (records.some((r) => r.toLowerCase().includes("v=dkim1") || r.toLowerCase().includes("p="))) {
        found.push(selector);
      }
    })
  );
  if (found.length === 0) {
    return {
      status: "fail",
      detail: `No DKIM key found at the common selectors (${DKIM_SELECTORS.join(", ")}). Mail is unsigned or uses a custom selector.`,
    };
  }
  return { status: "pass", detail: `DKIM key published (selector: ${found.join(", ")}).` };
}

export async function checkDmarc(domain: string): Promise<DmarcCheckResult> {
  const records = (await txtRecords(`_dmarc.${domain}`)).filter((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (records.length === 0) {
    return { status: "fail", detail: "No DMARC record. Receivers have no policy to apply.", policy: null };
  }
  const policy = (records[0].match(/\bp\s*=\s*(none|quarantine|reject)/i)?.[1] || "").toLowerCase() || null;
  if (policy === "none") {
    return {
      status: "warn",
      detail: "DMARC is monitor-only (p=none). Move to quarantine once reports look clean.",
      policy,
    };
  }
  return { status: "pass", detail: `DMARC enforced (p=${policy}).`, policy };
}
