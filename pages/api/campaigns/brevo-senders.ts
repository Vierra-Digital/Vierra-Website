import { withAuth } from "@/lib/api/withAuth";
import { listBrevoSenders } from "@/lib/campaigns/brevo/client";

/**
 * Proxies Brevo's GET /v3/senders so the campaigns UI can offer a dropdown of actually-registered
 * senders instead of a free-text email field a rep could mistype or that was never added in
 * Brevo's dashboard at all. Never exposes BREVO_API_KEY to the browser.
 */
export default withAuth(async (req, res) => {
  const result = await listBrevoSenders();
  if (!result.ok) {
    res.status(502).json({ message: result.message });
    return;
  }
  res.status(200).json({ senders: result.senders });
}, { methods: ["GET"] });
