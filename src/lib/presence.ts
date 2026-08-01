/** Online if last_seen within the server's 15-minute presence window. */
export function isOnlineFromSeen(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < 15 * 60 * 1000;
}
