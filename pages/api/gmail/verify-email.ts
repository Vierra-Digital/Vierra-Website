import { withAuth } from "@/lib/api/withAuth";
import { asStr } from "@/lib/api/parsing";
import { verifyEmailAddress } from "@/lib/email/verifyEmail";
import { mapInBatches } from "@/lib/batch";

/** Verify one or more email addresses (syntax + MX). Body: { email } or { emails: [] }. */
export default withAuth(
  async (req, res) => {
    const fromBody = Array.isArray(req.body?.emails) ? (req.body.emails as unknown[]).map((e) => asStr(e)) : [];
    const single = asStr(req.method === "GET" ? req.query.email : req.body?.email);
    const list = [...fromBody, single]
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (list.length === 0) {
      res.status(400).json({ message: "Provide an email or emails[]." });
      return;
    }
    // Bounded: each address is a DNS lookup, and firing up to 100 at once floods the resolver and
    // makes the slowest one define the whole response time.
    const results = await mapInBatches(list, (email) => verifyEmailAddress(email), 8);
    res.status(200).json({ results });
  },
  { methods: ["GET", "POST"] }
);
