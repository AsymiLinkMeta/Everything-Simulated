export const DEFAULT_DEPOSIT_PERCENT = 30;
export const MIN_DEPOSIT_INC_GST_CENTS = 50_000; // $500

export function parseDepositPercent(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return DEFAULT_DEPOSIT_PERCENT;
  return n;
}

/**
 * Deposit owed now, in cents inc GST, and its ex-GST equivalent.
 * Rule: percent of the order total, at least $500, never more than the total.
 * "full" charges the whole total.
 */
export function computeDeposit(input: { totalIncGstCents: number; percent?: number; full?: boolean; minCents?: number }) {
  const total = Math.max(0, Math.round(Number(input.totalIncGstCents) || 0));
  const percent = input.percent ?? DEFAULT_DEPOSIT_PERCENT;
  const min = input.minCents ?? MIN_DEPOSIT_INC_GST_CENTS;
  const raw = input.full ? total : Math.max(min, Math.round((total * percent) / 100));
  const depositIncGst = Math.min(raw, total);
  const depositExGst = Math.round(depositIncGst / 1.1);
  return { depositIncGst, depositExGst };
}
