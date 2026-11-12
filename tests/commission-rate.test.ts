import { describe, expect, it } from "vitest";
import { earningsHint, rowRate, unsetRateNotice, type RateState } from "@/lib/es/commission-rate";

const base: RateState = { rate: null, rate_source: "unset", earnings: { pending: 0, approved: 0, paid: 0, uncalculated: 0 } };

describe("commission rate wording", () => {
  it("no rate and nothing paid: plain 'not set'", () => {
    expect(earningsHint(base)).toBe("Rate not set");
    expect(unsetRateNotice(base, false)).toMatch(/hasn't been set yet/);
  });
  it("no rate but money already paid out: says it is locked in, not 'rate not set' beside it", () => {
    const d = { ...base, earnings: { pending: 0, approved: 0, paid: 31000, uncalculated: 1 } };
    expect(earningsHint(d)).toBe("Paid amounts locked in · new sales: rate not set · 1 not calculated");
    expect(unsetRateNotice(d, false)).toMatch(/locked in/);
    expect(unsetRateNotice(d, true)).toMatch(/keep the rate they were paid at/);
  });
  it("rate set: no notice, shows the rate", () => {
    const d: RateState = { ...base, rate: 0.05, rate_source: "default" };
    expect(unsetRateNotice(d, true)).toBeNull();
    expect(earningsHint(d)).toBe("Rate 5% (default)");
  });
  it("rows: paid and void never warn, open rows without a rate do", () => {
    expect(rowRate({ status: "paid", rate: 0.05, amount_cents: 100 })).toEqual({ text: "5%", warn: false });
    expect(rowRate({ status: "void", rate: null, amount_cents: null })).toEqual({ text: "—", warn: false });
    expect(rowRate({ status: "pending", rate: null, amount_cents: null })).toEqual({ text: "not set", warn: true });
  });
});
