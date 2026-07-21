import { withAuth } from "@/lib/api/withAuth";
import { getCompanyContextFor } from "@/lib/enrichment/companyContext";

/**
 * Panel-facing keyless company-context lookup. Given ?domain=, fetches + parses
 * the public website server-side (name, description, socials, emails, tech stack).
 * No third-party API keys required.
 */
export default withAuth(
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ message: "Method Not Allowed" });
      return;
    }
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
      console.error("enrichment/company error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  { methods: ["GET"] }
);
