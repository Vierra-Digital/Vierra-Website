import type { NextApiRequest, NextApiResponse } from "next";
import { applyCors, requireExtensionAuth } from "@/lib/extension/auth";
import { getCompanyContextFor } from "@/lib/enrichment/companyContext";

/**
 * Keyless company-context lookup for the extension. The extension passes the
 * prospect's company domain (scraped from the profile); we fetch + parse the
 * public site server-side. No third-party API keys.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const ctx = requireExtensionAuth(req, res);
  if (!ctx) return;

  const domain = typeof req.query.domain === "string" ? req.query.domain : "";
  const name = typeof req.query.name === "string" ? req.query.name : "";
  if (!domain && !name) {
    res.status(400).json({ message: "Missing domain or name" });
    return;
  }

  try {
    const { company, resolvedFrom } = await getCompanyContextFor({ domain, name });
    if (!company) {
      res.status(404).json({ message: "Could not resolve or fetch company context" });
      return;
    }
    res.status(200).json({ company, resolvedFrom });
  } catch (e) {
    console.error("extension/company error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
