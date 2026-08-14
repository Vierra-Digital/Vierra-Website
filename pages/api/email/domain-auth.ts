import { promises as dns } from "dns";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api/withAuth";

/**
 * Authentication posture for each domain the user sends from: SPF, DKIM and DMARC.
 *
 * These three records are the single biggest controllable factor in whether cold mail lands in
 * the inbox — a domain missing DMARC (or publishing `p=none`) gets throttled or spam-foldered by
 * Gmail/Outlook regardless of content. Checked live over DNS; nothing is stored.
 */

type RecordStatus = "pass" | "warn" | "fail";

type DomainAuth = {
  domain: string;
  accounts: string[];
  spf: { status: RecordStatus; detail: string };
  dkim: { status: RecordStatus; detail: string };
  dmarc: { status: RecordStatus; detail: string; policy: string | null };
};

/** All TXT records at `name`, each joined from its character-string chunks. "" on any DNS error. */
async function txtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function checkSpf(domain: string): Promise<DomainAuth["spf"]> {
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

async function checkDkim(domain: string): Promise<DomainAuth["dkim"]> {
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

async function checkDmarc(domain: string): Promise<DomainAuth["dmarc"]> {
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

export default withAuth(async (req, res, session) => {
  const accounts = await prisma.emailProviderAccount.findMany({
    where: { user_id: session.user.id },
    select: { account_email: true },
  });

  // Group the connected mailboxes by their domain — auth records are per-domain, not per-mailbox.
  const byDomain = new Map<string, string[]>();
  for (const { account_email } of accounts) {
    const domain = (account_email.split("@")[1] || "").trim().toLowerCase();
    if (!domain) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), account_email]);
  }

  const domains: DomainAuth[] = await Promise.all(
    [...byDomain.entries()].map(async ([domain, emails]) => {
      const [spf, dkim, dmarc] = await Promise.all([checkSpf(domain), checkDkim(domain), checkDmarc(domain)]);
      return { domain, accounts: emails, spf, dkim, dmarc };
    })
  );

  res.status(200).json({ domains });
}, { methods: ["GET"] });
