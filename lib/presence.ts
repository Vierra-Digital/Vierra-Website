export const ONLINE_AFTER_MINUTES = 10;
export const AWAY_AFTER_MINUTES = 30;

/** Single source of truth for presence status, shared by the dashboard and Staff Orbital so the two never disagree. */
export function computePresenceStatus(lastActiveAt: Date | string | null): "online" | "away" | "offline" {
  if (!lastActiveAt) return "offline";
  const lastActive = typeof lastActiveAt === "string" ? new Date(lastActiveAt) : lastActiveAt;
  const diffMinutes = (Date.now() - lastActive.getTime()) / (1000 * 60);
  if (diffMinutes <= ONLINE_AFTER_MINUTES) return "online";
  if (diffMinutes <= AWAY_AFTER_MINUTES) return "away";
  return "offline";
}
