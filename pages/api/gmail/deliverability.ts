import type { NextApiRequest, NextApiResponse } from "next";
import { promises as dns } from "dns";
import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";

/**
 * Domain-authentication health for a sending domain — pure DNS lookups (no external
 * services). Checks SPF (root TXT), DMARC (_dmarc TXT + policy), and DKIM (Google's
 * default `google._domainkey` selector, since sending is via Gmail/Workspace).
 * gmail.com / googlemail.com are managed by Google and always aligned.
 */
async function txtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

const GOOGLE_MANAGED = new Set(["gmail.com", "googlemail.com"]);

export default withAuth(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const domain = asStr(req.query.domain).trim().toLowerCase().replace(/^@/, "");
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      res.status(400).json({ message: "A valid domain is required." });
      return;
    }

    if (GOOGLE_MANAGED.has(domain)) {
      res.status(200).json({
        domain,
        googleManaged: true,
        spf: { found: true, record: "managed by Google" },
        dmarc: { found: true, policy: "quarantine", record: "managed by Google" },
        dkim: { found: true, selector: "google" },
      });
      return;
    }

    const [root, dmarc, dkim] = await Promise.all([
      txtRecords(domain),
      txtRecords(`_dmarc.${domain}`),
      txtRecords(`google._domainkey.${domain}`),
    ]);

    const spfRecord = root.find((r) => /^v=spf1/i.test(r)) || "";
    const dmarcRecord = dmarc.find((r) => /^v=DMARC1/i.test(r)) || "";
    const dmarcPolicy = (dmarcRecord.match(/\bp=([a-z]+)/i)?.[1] || "").toLowerCase();
    const dkimRecord = dkim.find((r) => /(v=DKIM1|k=rsa|p=[A-Za-z0-9+/])/i.test(r)) || "";

    res.status(200).json({
      domain,
      googleManaged: false,
      spf: { found: Boolean(spfRecord), record: spfRecord, includesGoogle: /include:_spf\.google\.com/i.test(spfRecord) },
      dmarc: { found: Boolean(dmarcRecord), policy: dmarcPolicy, record: dmarcRecord },
      dkim: { found: Boolean(dkimRecord), selector: "google" },
    });
  },
  { methods: ["GET"] }
);
