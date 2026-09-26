export function subscriptionExpiry(current: string | null, period: string, now: number): string {
  const currentTime = current ? Date.parse(current) : 0;
  const start = Number.isFinite(currentTime) ? Math.max(currentTime, now) : now;
  return new Date(start + (period === "year" ? 365 : 30) * 86_400_000).toISOString();
}
