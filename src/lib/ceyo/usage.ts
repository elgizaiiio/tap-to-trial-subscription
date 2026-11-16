export type UsageStatus = { plan: string; isPaid: boolean; hasAccess: boolean; trialActive: boolean; trialEndsAt: string | null; allowanceUsd: number; spentUsd: number; remainingUsd: number; stepUsd: number };
export const TRIAL_DAYS = 3;
/** Whole days left in the free trial, rounded up (0 when over or absent). */
export function trialDaysLeft(status: Pick<UsageStatus, "trialActive" | "trialEndsAt">, now = Date.now()): number {
  if (!status.trialActive || !status.trialEndsAt) return 0;
  const ms = new Date(status.trialEndsAt).getTime() - now;
  return Number.isFinite(ms) && ms > 0 ? Math.min(TRIAL_DAYS, Math.ceil(ms / 86_400_000)) : 0;
}
export function usagePercent(status: UsageStatus): number {
  if (!Number.isFinite(status.allowanceUsd) || status.allowanceUsd <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(status.spentUsd / status.allowanceUsd * 100)));
}
export const EXHAUSTED_MESSAGE = "Your 3-day free trial has ended. Subscribe to continue.";
export function isUsageExhausted(message: string | null | undefined) { return Boolean(message?.includes(EXHAUSTED_MESSAGE)); }