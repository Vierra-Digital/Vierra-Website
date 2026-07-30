/**
 * Post a message to the team Discord via an incoming webhook (env DISCORD_WEBHOOK_URL).
 * Best-effort and a no-op if the webhook isn't configured, so callers never need to guard.
 */
export async function notifyDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL || "";
  if (!url || !content.trim()) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
  } catch {
    /* notifications are best-effort */
  }
}

export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}
