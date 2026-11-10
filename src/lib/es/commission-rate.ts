/**
 * Wording for the commission rate when no rate is set.
 *
 * Paid-out commissions keep the rate they were paid at (they are never recalculated), so a
 * "rate not set" warning must not sit beside money that is already locked in. Open
 * (pending/approved) commissions are recalculated whenever the rate changes, so with no rate
 * they show as "not calculated".
 */
export type RateState = {
  rate: number | null;
  rate_source: "ambassador" | "default" | "unset";
  earnings: { pending: number; approved: number; paid: number; uncalculated: number };
};

export function ratePercent(rate: number | null) {
  return rate === null ? "not set" : `${(rate * 100).toFixed(rate * 100 < 10 ? 1 : 0).replace(/\.0$/, "")}%`;
}

/** The banner shown when no rate applies, or null when a rate is set. */
export function unsetRateNotice(d: RateState, staff: boolean): string | null {
  if (d.rate_source !== "unset") return null;
  const locked = d.earnings.paid > 0;
  if (staff) {
    return locked
      ? "No commission rate is set for this ambassador and there is no default rate. Commissions already paid out keep the rate they were paid at; open and new sales are calculated once a rate is set."
      : "No commission rate is set for this ambassador and there is no default rate. Sales are tracked; amounts are calculated once a rate is set.";
  }
  return locked
    ? "Commissions already paid to you are locked in at the rate they were paid at. The rate for open and new sales hasn't been set yet; they're tracked and will be calculated once the workshop sets it."
    : "Your commission rate hasn't been set yet. Every sale is still tracked and will be calculated once the workshop sets it.";
}

/** The small line under the Earnings total. */
export function earningsHint(d: RateState): string {
  const parts: string[] = [];
  if (d.rate_source === "unset") {
    parts.push(d.earnings.paid > 0 ? "Paid amounts locked in" : "Rate not set");
    if (d.earnings.paid > 0) parts.push("new sales: rate not set");
  } else {
    parts.push(`Rate ${ratePercent(d.rate)}${d.rate_source === "default" ? " (default)" : ""}`);
  }
  if (d.earnings.uncalculated) parts.push(`${d.earnings.uncalculated} not calculated`);
  return parts.join(" · ");
}

/** Rate cell for one commission row: paid and void rows never show a "not set" warning. */
export function rowRate(row: { status: string; rate: number | null; amount_cents: number | null }):
  { text: string; warn: boolean } {
  if (row.rate !== null) return { text: ratePercent(row.rate), warn: false };
  if (row.status === "void" || row.status === "paid") return { text: "—", warn: false };
  return { text: "not set", warn: true };
}
