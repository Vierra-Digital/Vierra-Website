import { withCronAuth } from "../_shared/auth.ts";
import { getValidGmailAccessToken } from "../_shared/gmail.ts";

/**
 * Register (renew) Gmail push notifications via users.watch for every connected Gmail account.
 * Edge Function port of pages/api/gmail/watch.ts. Dormant until GMAIL_PUBSUB_TOPIC is set.
 */
Deno.serve(
  withCronAuth(async (_req, supabase) => {
    const topicName = Deno.env.get("GMAIL_PUBSUB_TOPIC") || "";
    if (!topicName) {
      return Response.json({ ok: false, message: "GMAIL_PUBSUB_TOPIC not set — push is inactive (polling still runs)." });
    }

    const { data: tokens, error } = await supabase
      .from("platform_tokens")
      .select("user_id, platform")
      .like("platform", "gmail:%");
    if (error) {
      console.error("gmail watch: token query failed", error);
      return Response.json({ message: "Failed to load Gmail accounts." }, { status: 500 });
    }

    let registered = 0;
    let failed = 0;
    for (const row of tokens || []) {
      const accountEmail = row.platform.replace(/^gmail:/, "").toLowerCase();
      if (!accountEmail) continue;
      const token = await getValidGmailAccessToken(supabase, row.user_id, accountEmail);
      if (!token.ok) {
        failed += 1;
        continue;
      }
      try {
        const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
          method: "POST",
          headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
        });
        if (r.ok) registered += 1;
        else {
          failed += 1;
          console.error("gmail watch failed for", accountEmail, r.status, await r.text().catch(() => ""));
        }
      } catch (e) {
        failed += 1;
        console.error("gmail watch error for", accountEmail, e);
      }
    }

    return Response.json({ ok: true, registered, failed });
  })
);
